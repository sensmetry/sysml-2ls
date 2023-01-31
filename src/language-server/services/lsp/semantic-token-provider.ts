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
    AllSemanticTokenModifiers,
    AllSemanticTokenTypes,
    AstNode,
    DocumentState,
    LangiumDocument,
    SemanticTokenAcceptor,
    DefaultSemanticTokenOptions,
} from "langium";
import {
    Element,
    SysMlAstType,
    ElementReference,
    LiteralString,
    LiteralNumber,
    Comment,
    TextualRepresentation,
    OperatorExpression,
    isType,
    isClassifier,
    isFeature,
    isAlias,
} from "../../generated/ast";
import {
    CancellationToken,
    SemanticTokenModifiers,
    SemanticTokenTypes,
    SemanticTokens,
    SemanticTokensDelta,
    SemanticTokensDeltaParams,
    SemanticTokensParams,
    SemanticTokensRangeParams,
    Connection,
    SemanticTokensRefreshRequest,
    SemanticTokensOptions,
} from "vscode-languageserver";
import { SysMLDefaultServices } from "../services";
import { TypeMap, typeIndex } from "../../model";
import { streamAllContents } from "../../utils/ast-util";
import { SysMLDocumentBuilder } from "../shared/workspace/document-builder";

type ReturnType = void | "prune" | undefined;

//! Changes to the following need to be reflected in package.json
/**
 * Semantic token types used by the SysML language server
 */
export const SysMLSemanticTokenTypes = {
    // builtin
    class: SemanticTokenTypes.class,
    comment: SemanticTokenTypes.comment,
    enum: SemanticTokenTypes.enum,
    enumMember: SemanticTokenTypes.enumMember,
    event: SemanticTokenTypes.event,
    function: SemanticTokenTypes.function,
    interface: SemanticTokenTypes.interface,
    keyword: SemanticTokenTypes.keyword,
    macro: SemanticTokenTypes.macro,
    method: SemanticTokenTypes.method,
    modifier: SemanticTokenTypes.modifier,
    namespace: SemanticTokenTypes.namespace,
    number: SemanticTokenTypes.number,
    operator: SemanticTokenTypes.operator,
    parameter: SemanticTokenTypes.parameter,
    property: SemanticTokenTypes.property,
    regexp: SemanticTokenTypes.regexp,
    string: SemanticTokenTypes.string,
    struct: SemanticTokenTypes.struct,
    type: SemanticTokenTypes.type,
    typeParameter: SemanticTokenTypes.typeParameter,
    variable: SemanticTokenTypes.variable,
    decorator: SemanticTokenTypes.decorator,

    // custom, need to be registered in package.json
    annotation: "annotation",
    annotationBody: "annotationBody",
    relationship: "relationship",
    metaclass: "metaclass",
};

/**
 * Semantic token modifiers used by the SysML language server
 */
export const SysMLSemanticTokenModifiers = {
    // builtin
    abstract: SemanticTokenModifiers.abstract,
    async: SemanticTokenModifiers.async,
    declaration: SemanticTokenModifiers.declaration,
    defaultLibrary: SemanticTokenModifiers.defaultLibrary,
    definition: SemanticTokenModifiers.definition,
    deprecated: SemanticTokenModifiers.deprecated,
    documentation: SemanticTokenModifiers.documentation,
    modification: SemanticTokenModifiers.modification,
    readonly: SemanticTokenModifiers.readonly,
    static: SemanticTokenModifiers.static,

    // custom, need to be registered in package.json
};
//! -------------------------------------------------------------------

// register custom types and modifiers, have to do it on global variables...
Object.values(SysMLSemanticTokenTypes).forEach(
    (name, index) => (AllSemanticTokenTypes[name] = index)
);

Object.values(SysMLSemanticTokenModifiers).forEach(
    (name, index) => (AllSemanticTokenModifiers[name] = 1 << index)
);

/**
 * Default semantic tokens options implemented by the SysML language server
 */
export const DefaultSysMLSemanticTokenOptions: SemanticTokensOptions = {
    ...DefaultSemanticTokenOptions,
    legend: {
        tokenTypes: Object.keys(SysMLSemanticTokenTypes),
        tokenModifiers: Object.keys(SysMLSemanticTokenModifiers),
    },
};

/**
 * Basic types to semantic tokens map for name and reference highlighting
 */
const TYPE_TOKENS: { readonly [K in keyof SysMlAstType]?: string } = {
    Namespace: SysMLSemanticTokenTypes.namespace,
    Type: SysMLSemanticTokenTypes.type,
    Feature: SysMLSemanticTokenTypes.variable,
    Class: SysMLSemanticTokenTypes.class,
    Structure: SysMLSemanticTokenTypes.struct,
    Comment: SysMLSemanticTokenTypes.annotation,
    TextualRepresentation: SysMLSemanticTokenTypes.annotation,
    EnumerationDefinition: SysMLSemanticTokenTypes.enum,
    EnumerationUsage: SysMLSemanticTokenTypes.enumMember,
    SysMLFunction: SysMLSemanticTokenTypes.function,
    Expression: SysMLSemanticTokenTypes.method,
    LiteralNumber: SysMLSemanticTokenTypes.number,
    LiteralString: SysMLSemanticTokenTypes.string,
    Alias: SysMLSemanticTokenTypes.relationship,
    Relationship: SysMLSemanticTokenTypes.relationship,
    Metaclass: SysMLSemanticTokenTypes.metaclass,
};
type HighlightFunction<T = AstNode> = (node: T, acceptor: SemanticTokenAcceptor) => ReturnType;
type HighlightMap = { [K in keyof SysMlAstType]?: HighlightFunction<SysMlAstType[K]>[] };

export class SysMLSemanticTokenProvider extends AbstractSemanticTokenProvider {
    protected readonly tokenMap;
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

        this.tokenMap = typeIndex.expandToDerivedTypes(TYPE_TOKENS);
        this.highlightMap = typeIndex.expandAndMerge({
            Element: [this.element],
            ElementReference: [this.elementReference],
            LiteralNumber: [this.literalNumber],
            LiteralString: [this.literalString],
            Comment: [this.comment],
            TextualRepresentation: [this.comment, this.textualRep],
            OperatorExpression: [this.operatorExpression],
        } as HighlightMap as TypeMap<SysMlAstType, HighlightFunction[]>);

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
     * Compute semantic token modifiers for {@link node}
     * @param node
     * @returns array of modifier names
     */
    protected elementModifiers(node: AstNode): string[] {
        const mods: string[] = [];

        if (isType(node) && node.$meta.isAbstract) {
            mods.push(SysMLSemanticTokenModifiers.abstract);
        }
        if (isClassifier(node)) {
            mods.push(SysMLSemanticTokenModifiers.definition);
        }
        if (node.$meta?.isStandardElement) {
            mods.push(SysMLSemanticTokenModifiers.defaultLibrary);
        }
        if (isFeature(node) && node.$meta.isReadonly) {
            mods.push(SysMLSemanticTokenModifiers.readonly);
        }

        return mods;
    }

    /**
     * Highlight {@link node} name and short name
     * @param node
     * @param acceptor
     * @param type optional semantic token type override
     */
    protected element(node: Element, acceptor: SemanticTokenAcceptor, type?: string): ReturnType {
        type ??= this.tokenMap.get(node.$type);
        if (!type) return;
        const mods = this.elementModifiers(node);

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
        for (const ref of node.chain) {
            ++index;
            let target = ref.ref;
            if (isAlias(target)) target = target.$meta.for.target?.node;
            if (!target) continue;
            const type = this.tokenMap.get(target.$type);
            if (!type) continue;
            acceptor({
                node: node,
                property: "chain",
                index: index,
                type: type,
                modifier: this.elementModifiers(target),
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
    override semanticHighlight(
        document: LangiumDocument,
        params: SemanticTokensParams,
        cancelToken = CancellationToken.None
    ): SemanticTokens {
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

            const tokens = super.semanticHighlight(document, params, cancelToken);

            // only cache the tokens if the document is in a state for full
            // highlighting
            this.cachedTokens.set(uri, document.state >= DocumentState.Linked ? tokens : null);

            return tokens;
        } catch (e) {
            console.error(`Uncaught error while computing full semantic highlighting: ${e}`);
            if (e instanceof Error) console.error(e.stack);
            return { data: [] };
        }
    }

    override semanticHighlightRange(
        document: LangiumDocument,
        params: SemanticTokensRangeParams,
        cancelToken = CancellationToken.None
    ): SemanticTokens {
        try {
            return super.semanticHighlightRange(document, params, cancelToken);
        } catch (e) {
            console.error(`Uncaught error while computing semantic highlighting range: ${e}`);
            if (e instanceof Error) console.error(e.stack);
            return { data: [] };
        }
    }

    override semanticHighlightDelta(
        document: LangiumDocument,
        params: SemanticTokensDeltaParams,
        cancelToken = CancellationToken.None
    ): SemanticTokens | SemanticTokensDelta {
        try {
            return super.semanticHighlightDelta(document, params, cancelToken);
        } catch (e) {
            console.error(`Uncaught error while computing semantic highlighting delta: ${e}`);
            if (e instanceof Error) console.error(e.stack);
            return { data: [] };
        }
    }

    /**
     * Bugfix of {@link AbstractSemanticTokenProvider.computeHighlighting} that
     * doesn't crash on AST nodes without CST nodes
     * @inheritdoc
     */
    protected override computeHighlighting(
        document: LangiumDocument,
        acceptor: SemanticTokenAcceptor,
        cancelToken: CancellationToken
    ): void {
        const root = document.parseResult.value;
        if (this.highlightElement(root, acceptor) === "prune") {
            // If the root node is pruned, we can return here already
            return;
        }
        const treeIterator = streamAllContents(root).iterator();
        let result: IteratorResult<AstNode>;
        do {
            result = treeIterator.next();
            if (!result.done) {
                if (cancelToken.isCancellationRequested) {
                    break;
                }
                const node = result.value;

                // TODO: merge in Langium the next 2 lines of code
                // probably a programmatic node with no reference to the
                // document, just skip it
                const nodeRange = node.$cstNode?.range;
                if (!nodeRange) continue;
                // TODO: ----------------------------------------

                const comparedRange = this.compareRange(nodeRange);
                if (comparedRange === 1) {
                    break; // Every following element will not be in range, so end the loop
                } else if (comparedRange === -1) {
                    continue; // Current element is ending before range starts, skip to next element
                }
                if (this.highlightElement(node, acceptor) === "prune") {
                    treeIterator.prune();
                }
            }
        } while (!result.done);
    }
}
