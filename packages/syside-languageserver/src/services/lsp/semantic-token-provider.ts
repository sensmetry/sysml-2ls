/********************************************************************************
 * Copyright (c) 2022-2023 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import {
    AbstractSemanticTokenProvider,
    AstNode,
    DocumentState,
    LangiumDocument,
    SemanticTokenAcceptor,
    isOperationCancelled,
} from "langium";
import {
    Element,
    ElementReference,
    LiteralString,
    LiteralNumber,
    Comment,
    TextualRepresentation,
    OperatorExpression,
    Membership,
} from "../../generated/ast";
import {
    CancellationToken,
    SemanticTokens,
    SemanticTokensDelta,
    SemanticTokensDeltaParams,
    SemanticTokensParams,
    SemanticTokensRangeParams,
    Connection,
    SemanticTokensRefreshRequest,
    ResponseError,
} from "vscode-languageserver";
import { SysMLDefaultServices } from "../services";
import { TypeMap, typeIndex } from "../../model";
import { SysMLDocumentBuilder } from "../shared/workspace/document-builder";
import { SysMLType, SysMLTypeList } from "../sysml-ast-reflection";
import {
    SysMLSemanticTokenModifiers,
    SysMLSemanticTokenTypes,
    tokenModifiers,
    tokenType,
} from "../../model/semantic-tokens";

type ReturnType = void | "prune" | undefined;

type HighlightFunction<T = AstNode> = (node: T, acceptor: SemanticTokenAcceptor) => ReturnType;
type HighlightMap = { [K in SysMLType]?: HighlightFunction<SysMLTypeList[K]>[] };

export class SysMLSemanticTokenProvider extends AbstractSemanticTokenProvider {
    protected readonly highlightMap: Map<string, HighlightFunction[]>;
    protected readonly connection: Connection | undefined;
    protected readonly builder: SysMLDocumentBuilder;

    /**
     * Cache of document uris to completed token requests
     */
    protected readonly cachedTokens = new Map<string, SemanticTokens | null>();

    /**
     * Set of documents currently being built
     */
    protected readonly inBuild = new Set<string>();
    /**
     * Number of documents that have been built from {@link inBuild}
     */
    protected built = 0;

    /**
     * If true, language client supports semantic token refresh request
     */
    protected supportsRefresh = false;

    constructor(services: SysMLDefaultServices) {
        super(services);
        this.connection = services.shared.lsp.Connection;
        this.builder = services.shared.workspace.DocumentBuilder;

        this.highlightMap = typeIndex.expandAndMerge({
            Element: [this.element],
            ElementReference: [this.elementReference],
            LiteralNumber: [this.literalNumber],
            LiteralString: [this.literalString],
            Comment: [this.comment],
            TextualRepresentation: [this.comment, this.textualRep],
            OperatorExpression: [this.operatorExpression],
        } as HighlightMap as TypeMap<SysMLTypeList, HighlightFunction[]>);

        // first, clearing out stale caches due to doc updates
        this.builder.onUpdate(async (changed, deleted) => {
            this.inBuild.clear();
            this.built = 0;

            changed.forEach((uri) => {
                const str = uri.toString();
                const old = this.cachedTokens.get(str);
                // preserving incomplete tokens tag will request a refresh once
                // this doc is linked
                if (old) this.cachedTokens.delete(str);
                else if (old === null) this.inBuild.add(str);
            });
            deleted.forEach((uri) => this.cachedTokens.delete(uri.toString()));
        });
        // later, checking if we have any stale caches from old documents or
        // documents that have had incomplete highlighting computed
        this.builder.onBuildPhase(DocumentState.Linked, async (docs) => this.refresh(docs));

        const disposable = services.shared.lsp.LanguageServer.onInitialize((params) => {
            this.supportsRefresh =
                (this.connection &&
                    params.capabilities.workspace?.semanticTokens?.refreshSupport) ??
                false;
            disposable.dispose();
        });

        this.builder.onDocumentPhase(DocumentState.Linked, (doc) => {
            if (this.inBuild.has(doc.uriString)) {
                this.built++;
                if (this.inBuild.size === this.built) {
                    this.refresh(this.inBuild);
                    this.inBuild.clear();
                    this.built = 0;
                }
            }
        });
    }

    /**
     * Request a refresh of semantic tokens for {@link docs}. If the client
     * doesn't support semantic token refresh or there have been no incomplete
     * highlighting computed for any of the {@link docs}, the refresh request
     * is not sent.
     * @param docs documents that may need to have semantic highlighting refreshed
     */
    protected refresh(docs: Iterable<LangiumDocument | string>): void {
        if (!this.supportsRefresh) return;

        let containsIncomplete = false;
        for (const doc of docs) {
            const uri = typeof doc === "string" ? doc : doc.uriString;
            if (this.cachedTokens.get(uri) === null) {
                containsIncomplete = true;
                // reset the associated tokens builder to force recomputation
                this.tokensBuilders.delete(uri);
                this.cachedTokens.delete(uri);
            }
        }

        // only requesting refresh in we have incomplete highlighting computed
        if (containsIncomplete) {
            this.connection?.sendRequest(SemanticTokensRefreshRequest.method);
        }
    }

    /**
     * Generic AST node highlight method that dispatches to the registered
     * highlight functions based on AST node type.
     * @param node AST node to compute highlighting for
     * @param acceptor
     */
    protected override highlightElement(
        node: AstNode,
        acceptor: SemanticTokenAcceptor
    ): ReturnType {
        const highlights = this.highlightMap.get(node.$type);
        if (!highlights) return;
        for (const fn of highlights) {
            fn.call(this, node, acceptor);
        }
    }

    /**
     * Highlight {@link node} name and short name
     * @param node
     * @param acceptor
     * @param type optional semantic token type override
     */
    protected element(node: Element, acceptor: SemanticTokenAcceptor, type?: string): ReturnType {
        type ??= tokenType(node.$meta);
        if (!type || !(node.declaredName || node.declaredShortName)) return;
        const mods = tokenModifiers(node.$meta);

        // this is also a declaration
        mods.push(SysMLSemanticTokenModifiers.declaration);

        if (node.declaredName)
            acceptor({
                node: node,
                property: "declaredName",
                type: type,
                modifier: mods,
            });
        if (node.declaredShortName)
            acceptor({
                node: node,
                property: "declaredShortName",
                type: type,
                modifier: mods,
            });
    }

    /**
     * Highlight all references in the {@link node}. Currently, doesn't do
     * anything unless the reference has been linked.
     */
    protected elementReference(
        node: ElementReference,
        acceptor: SemanticTokenAcceptor
    ): ReturnType {
        const doc = node.$meta.document;
        if (!doc || doc.state < DocumentState.ComputedScopes) return;

        // TODO: remove this check once eager linking doesn't cause parsing
        // issues
        if (!node.$meta.to.cached) return;

        let index = -1;
        for (const ref of node.parts) {
            ++index;
            let target = ref.ref?.$meta;
            if (target?.is(Membership)) target = target.element();
            if (!target) continue;
            const type = tokenType(target);
            if (!type) continue;
            acceptor({
                node: node,
                property: "parts",
                index: index,
                type: type,
                modifier: tokenModifiers(target),
            });
        }
    }

    /**
     * Highlight string literals
     */
    protected literalString(node: LiteralString, acceptor: SemanticTokenAcceptor): void {
        if (!node.$cstNode) return;
        acceptor({
            node: node,
            cst: node.$cstNode,
            type: SysMLSemanticTokenTypes.string,
        });
    }

    /**
     * Highlight number literals
     */
    protected literalNumber(node: LiteralNumber, acceptor: SemanticTokenAcceptor): void {
        if (!node.$cstNode) return;
        acceptor({
            node: node,
            cst: node.$cstNode,
            type: SysMLSemanticTokenTypes.number,
        });
    }

    /**
     * Highlight comment bodies
     */
    protected comment(
        node: Comment | TextualRepresentation,
        acceptor: SemanticTokenAcceptor
    ): void {
        acceptor({
            node: node,
            property: "body",
            type: SysMLSemanticTokenTypes.annotationBody,
        });
    }

    /**
     * Highlight textual representation language
     */
    protected textualRep(node: TextualRepresentation, acceptor: SemanticTokenAcceptor): void {
        acceptor({
            node,
            property: "language",
            type: SysMLSemanticTokenTypes.string,
        });
    }

    /**
     * Highlight operator expression operator
     */
    protected operatorExpression(node: OperatorExpression, acceptor: SemanticTokenAcceptor): void {
        if (!node.operator) return;
        acceptor({
            node: node,
            property: "operator",
            type: SysMLSemanticTokenTypes.operator,
        });
    }

    protected override createAcceptor(): SemanticTokenAcceptor {
        const acceptor = super.createAcceptor();
        return (options) => {
            try {
                acceptor(options);
            } catch (e) {
                console.error(`Error while resolving semantic highlighting ${e}`);
                if (e instanceof Error) {
                    console.error(e.stack);
                }
            }
        };
    }

    /**
     * An extension of default
     * {@link AbstractSemanticTokenProvider.semanticHighlight} to work cached
     * tokens and refresh requests
     * @inheritdoc
     */
    override async semanticHighlight(
        document: LangiumDocument,
        params: SemanticTokensParams,
        cancelToken = CancellationToken.None
    ): Promise<SemanticTokens> {
        try {
            const uri = document.uriString ?? document.uri.toString();

            if (document.state >= DocumentState.Linked) {
                // The document has reached a state where a full semantic
                // highlighting is available. Check the cache first, in case of
                // recomputing tokens due to a refresh request, and use the last
                // computed tokens if they exist
                const cached = this.cachedTokens.get(uri);
                if (cached) {
                    return cached;
                }
            }

            const tokens = await super.semanticHighlight(document, params, cancelToken);

            // only cache the tokens if the document is in a state for full
            // highlighting
            this.cachedTokens.set(uri, document.state >= DocumentState.Linked ? tokens : null);

            return tokens;
        } catch (e) {
            return onSemanticTokenError(e, "full");
        }
    }

    override async semanticHighlightRange(
        document: LangiumDocument,
        params: SemanticTokensRangeParams,
        cancelToken = CancellationToken.None
    ): Promise<SemanticTokens> {
        try {
            return super.semanticHighlightRange(document, params, cancelToken);
        } catch (e) {
            return onSemanticTokenError(e, "range");
        }
    }

    override async semanticHighlightDelta(
        document: LangiumDocument,
        params: SemanticTokensDeltaParams,
        cancelToken = CancellationToken.None
    ): Promise<SemanticTokens | SemanticTokensDelta> {
        try {
            return super.semanticHighlightDelta(document, params, cancelToken);
        } catch (e) {
            return onSemanticTokenError(e, "delta");
        }
    }
}

function onSemanticTokenError(e: unknown, kind: string): SemanticTokens {
    // rethrowing `ResponseError` and `OperationCancelled` so that they show up
    // in server trace
    if (e instanceof ResponseError || isOperationCancelled(e)) throw e;

    console.error(`Uncaught error while computing ${kind} semantic highlighting: ${String(e)}`);
    if (e instanceof Error) console.error(e.stack);

    return { data: [] };
}
