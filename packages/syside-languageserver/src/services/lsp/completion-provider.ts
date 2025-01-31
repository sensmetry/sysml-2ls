/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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

/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    AstNode,
    CompletionAcceptor,
    CompletionContext,
    CompletionValueItem,
    DefaultCompletionProvider,
    DocumentState,
    findLeafNodeAtOffset,
    IndexManager,
    interruptAndCheck,
    LangiumDocument,
    MaybePromise,
    NextFeature,
    stream,
} from "langium";
import { CrossReference, Keyword } from "langium/lib/grammar/generated/ast";
import { SysMLDefaultServices } from "../services";
import {
    FeatureChainExpression,
    InlineExpression,
    isElementReference,
    isFeature,
    MetadataAccessExpression,
} from "../../generated/ast";
import {
    CancellationToken,
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    CompletionParams,
    CompletionTriggerKind,
} from "vscode-languageserver";
import { BuildProgress } from "../shared/workspace/documents";
import { SysMLScopeProvider } from "../references/scope-provider";
import { ScopeStream, SysMLScope } from "../../utils/scopes";
import { asyncWaitWhile } from "../../utils/common";
import { MembershipMeta } from "../../model";
import { ScopeOptions } from "../../utils/scope-util";

const ALPHA_NUM = /[a-zA-z\d_]/;
const NON_ALPHA_NUM = /[^a-zA-z\d_\s]/;
const NODE_END_CHAR = /[{};]$/;

// TODO: show docs in label details

const SCOPE_TOKENS: readonly string[] = ["::", ".", "'", "''"] as const;
const RELATIONSHIP_KEYWORDS: ReadonlySet<string> = new Set([
    ":",
    ":>>",
    ":>",
    "::>",
    "specializes",
    "subsets",
    "redefines",
    "references",
    /* typed, featured, defined */ "by",
    "conjugates",
    /* disjoint */ "from",
    "unions",
    "intersects",
    "differences",
    "chains",
    /* inverse */ "of",
]);
const TRIGGER_KEYWORDS: readonly string[] = ["@", "@@", "#", "->"] as const;
export const SUPPORTED_TRIGGER_CHARACTERS: readonly string[] = stream(
    SCOPE_TOKENS,
    TRIGGER_KEYWORDS,
    RELATIONSHIP_KEYWORDS
)
    // only the last character triggers completion
    .map((v) => v.charAt(v.length - 1))
    // filter out alpha numerical characters since completion is triggered
    // automatically for them
    .filter((c) => !ALPHA_NUM.test(c))
    .distinct()
    .toArray();

export class SysMLCompletionProvider extends DefaultCompletionProvider {
    protected readonly indexManager: IndexManager;
    protected override readonly scopeProvider: SysMLScopeProvider;
    protected readonly keywords: Set<string>;

    // cache for cancelation tokens since default getCompletion doesn't
    // use/forward them which can lead to deadlocks while waiting on references
    // to link
    protected readonly cancelTokens = new WeakMap<LangiumDocument, CancellationToken>();

    constructor(services: SysMLDefaultServices) {
        super(services);
        this.indexManager = services.shared.workspace.IndexManager;
        this.scopeProvider = services.references.ScopeProvider;

        const lexer = services.parser.Lexer;

        // TODO: extend default lexer and cache keywords there
        this.keywords = new Set(
            stream(Object.entries(lexer.definition))
                // filter out terminal rules
                .filter(([name, type]) => name === type.PATTERN)
                .map(([name, _]) => name)
        );
    }

    override async getCompletion(
        document: LangiumDocument,
        params: CompletionParams,
        token = CancellationToken.None
    ): Promise<CompletionList | undefined> {
        // wait until the document actually starts building
        while (document.state === DocumentState.Changed) {
            await interruptAndCheck(token);
        }

        // prioritizing custom completion method since it suggests references
        // more often, the default langium completion suggests keywords too
        // often IMO
        let list = await this.getTriggerCompletion(document, params, token);

        // fallback to default completion that also does keywords
        if (!list && params.context?.triggerKind !== CompletionTriggerKind.TriggerCharacter) {
            this.cancelTokens.set(document, token);
            list = await super.getCompletion(document, params);
        }

        if (list) {
            // filter out duplicate names since they would be hidden by scope
            // resolution anyway
            list.items = stream(list.items)
                .distinct((item) => item.label)
                .toArray();
        }

        return list;
    }

    /**
     * Custom completion computation method that only computes reference
     * completions
     * @see {@link getCompletion}
     */
    protected async getTriggerCompletion(
        document: LangiumDocument,
        params: CompletionParams,
        cancelToken: CancellationToken
    ): Promise<CompletionList | undefined> {
        const root = document.parseResult.value;
        const cst = root.$cstNode;
        if (!cst) {
            return undefined;
        }

        const textDocument = document.textDocument;
        const text = textDocument.getText();
        const offset = textDocument.offsetAt(params.position);

        // if triggered by a special character, find its offset in case it's not
        // separated from the next token
        let tokenEnd: number;
        if (params.context?.triggerCharacter) {
            tokenEnd = this.backtrackToToken(text, offset, params.context.triggerCharacter);
        } else {
            tokenEnd = this.backtrackToAnyToken(text, offset);
            // skip the node end characters since it's not part of the trigger
            if (tokenEnd < text.length && NODE_END_CHAR.test(text.charAt(tokenEnd))) tokenEnd--;
        }

        // try finding the node at the token
        let node = findLeafNodeAtOffset(cst, tokenEnd);

        let token = "";
        let tokenStart: number;
        if (!node) {
            // failed to find a valid node, this can happen on unbalanced quotes
            // or keywords
            tokenStart = this.backtrackToAnyTriggerStart(text, tokenEnd);

            // -1 to leave the trigger token
            const nodeOffset = this.backtrackToAnyToken(text, tokenStart - 1);
            node = findLeafNodeAtOffset(cst, nodeOffset);
            if (node) token = text.substring(node.end, tokenEnd + 1).trim();
        } else {
            // Langium 1.1.0 may no longer parse token keywords into CST nodes,
            // check the text for the token instead
            const maybeToken = text.substring(node.end, tokenEnd + 1).trim();
            if (maybeToken.length > 0) {
                tokenStart = this.backtrackToAnyTriggerStart(text, tokenEnd);
                token = text.substring(tokenStart, tokenEnd + 1);
            } else {
                token = node.text;
                tokenStart = node.offset;
            }
        }

        if (token === ".") {
            // for '.', find the preceding CST node as it is also used a an
            // operator in expressions. The preceding reference node will be
            // used for scope resolution
            const nodeOffset = this.backtrackToAnyToken(text, tokenStart - 1);
            node = findLeafNodeAtOffset(cst, nodeOffset);
        }

        if (!node) return;

        // wrapper over base `fillCompletionItem` to account for multi-words and
        // quotes
        const fillCompletionItem = (value: CompletionValueItem): CompletionItem | undefined => {
            // need at least a single quote to start multi-word matching
            if ((!startQuote && !endQuote) || value.textEdit)
                return this.fillCompletionItem(textDocument, offset, value);

            const label = value.label;
            if (!label) return;

            let start = tokenStart;
            let end = tokenEnd;
            let identifier = token;

            // strip quotes from the identifier and update editing offsets
            if (startQuote) {
                start++;
                identifier = token.substring(1);
            }
            if (endQuote) {
                end--;
                identifier = identifier.substring(0, identifier.length - 1);
            }

            if (!this.charactersFuzzyMatch(identifier, label)) return;

            value.textEdit = {
                newText: label,
                range: {
                    start: textDocument.positionAt(start),
                    end: textDocument.positionAt(end),
                },
            };

            // base method will not attempt to rebuild `textEdit` since one
            // already exists
            return this.fillCompletionItem(textDocument, offset, value);
        };

        const items: CompletionItem[] = [];
        // if offset equals start, the cursor is before the quote
        const startQuote = offset !== tokenStart && token.startsWith("'");
        const endQuote = (token.length > 1 || !startQuote) && token.endsWith("'");
        const withQuotes = startQuote && endQuote;
        // Enclosing quotes were removed for name resolution so if the name
        // clashes with a keyword or it doesn't match a regular ID rule, enclose
        // the new text in quotes if it doesn't already
        const refAcceptor: CompletionAcceptor = (value) => {
            const completionItem = fillCompletionItem(value);
            if (completionItem) {
                if (
                    !withQuotes &&
                    completionItem.textEdit &&
                    this.isRestrictedName(completionItem.textEdit.newText)
                ) {
                    completionItem.textEdit.newText = `${startQuote ? "" : "'"}${
                        completionItem.textEdit.newText
                    }${endQuote ? "" : "'"}`;
                }
                items.push(completionItem);
            }
        };

        if (SCOPE_TOKENS.includes(token) || /^'.*'$/.test(token)) {
            // Special handling for scope separators
            if (!isElementReference(node.element)) return;
            // text surrounded by quotes is parsed as a reference part so have
            // to skip it as it is currently incomplete
            const end = withQuotes ? 1 : 0;

            // only feature elements can chained with "." tokens, if the last
            // element is not a feature, skip its scope completion
            const lastRef = node.element.$meta.found.at(end - 1);
            if (token !== "." || !lastRef || isFeature(lastRef)) {
                await this.computeScopeCompletion(
                    node.element,
                    refAcceptor,
                    document,
                    cancelToken,
                    { index: node.element.parts.length - end }
                );
            }

            // only add .metadata completion if the cursor is in inline
            // expression scope and the previous reference is not a feature
            // chain
            const owner = node.element.$meta.owner();
            if (token === "." && owner?.is(InlineExpression) && !owner.is(FeatureChainExpression)) {
                const item = this.fillCompletionItem(textDocument, offset, {
                    label: "metadata",
                    kind: CompletionItemKind.Operator,
                    detail: MetadataAccessExpression,
                    textEdit: super.buildCompletionTextEdit(
                        textDocument,
                        offset,
                        "metadata",
                        "metadata"
                    ),
                    sortText: "1",
                });
                if (item) items.push(item);
            }
        } else if (RELATIONSHIP_KEYWORDS.has(token)) {
            let element: AstNode | undefined;
            if (/;|\{|\}/.test(node.text)) {
                // the token starts the new element so we are already at the
                // owning element
                element = node.element;
            } else {
                // need to go back to the owning type
                element = node.element.$container;
            }
            if (!element) return;
            await this.computeScopeCompletion(element, refAcceptor, document, cancelToken, {
                skip: node.element.$meta,
            });
        } else if (TRIGGER_KEYWORDS.includes(token) || isElementReference(node.element)) {
            await this.computeScopeCompletion(node.element, refAcceptor, document, cancelToken);
        } else {
            return undefined;
        }

        return CompletionList.create(items, true);
    }

    protected override completionForCrossReference(
        context: CompletionContext,
        _crossRef: NextFeature<CrossReference>,
        acceptor: CompletionAcceptor
    ): MaybePromise<void> {
        const node = context.node;
        if (!node) return;
        return this.computeScopeCompletion(
            node,
            acceptor,
            context.document,
            CancellationToken.None
        );
    }

    protected override completionFor(
        context: CompletionContext,
        next: NextFeature,
        acceptor: CompletionAcceptor,
        token = CancellationToken.None
    ): MaybePromise<void> {
        if (token === CancellationToken.None)
            // check tokens cache (i.e. here from super.getCompletion which
            // doesn't pass token)
            token = this.cancelTokens.get(context.document) ?? token;

        // Prioritise completion for references over keywords in the default
        // implementation
        if (isElementReference(context.node))
            return this.computeScopeCompletion(context.node, acceptor, context.document, token);
        return super.completionFor(context, next, acceptor);
    }

    protected async computeScopeCompletion(
        node: AstNode,
        acceptor: CompletionAcceptor,
        document: LangiumDocument,
        token: CancellationToken,
        options?: ScopeOptions & { index?: number }
    ): Promise<void> {
        try {
            let scope: SysMLScope | undefined;
            let index = options?.index;
            if (isElementReference(node)) {
                if (index === undefined) {
                    // Compute autocompletion for the last reference by default
                    index = node.parts.length - 1;
                }

                if (index < 0) return;
                const meta = node.$meta;

                // Wait until the reference is resolved (or fails), if the
                // document is no longer being built the reference will not be
                // ever be resolved so detect that as well.
                const predicate = (): boolean =>
                    !meta.to.cached && document.progress <= BuildProgress.Building;

                await asyncWaitWhile(predicate, {}, token);

                if (index === 0 || meta.found.at(index - 1))
                    scope = this.scopeProvider.getElementReferenceScope(meta, index);
                // failed to resolve reference so don't return any completion
                else return;

                // use scope from the reference parent container as fallback
                if (!scope) {
                    node = node.$container;
                }
            }

            if (!scope) {
                // wait until it is safe to try and get scopes
                const predicate = (): boolean => document.state < DocumentState.ComputedScopes;
                await asyncWaitWhile(predicate, {}, token);
                // completion for parent items
                scope = this.scopeProvider.initialScope(node.$meta, document, options);
            }

            if (!scope) return;

            const visited = new Set<string>();
            const collect = (s: SysMLScope, index: number): void => {
                s.getAllExportedElements().forEach(([name, e]) => {
                    if (visited.has(name)) return;
                    visited.add(name);

                    const item = this.createMemberCompletionItem(e, name);
                    // length 4 should be more than enough (10k numbers)
                    item.sortText = index.toString().padStart(4, "0");
                    acceptor(item);
                });
            };

            if (scope instanceof ScopeStream) scope.getChildScopes().forEach(collect);
            else collect(scope, 0);
        } catch (err) {
            console.error(err);
        }
    }

    // TODO: should be in custom lexer
    /**
     * Check if {@link name} is not a valid element identifier
     * @param name Name string to check
     * @returns True if name clashes with a reserved language keyword/token or
     * the name doesn't match the name RegExp
     */
    protected isRestrictedName(name: string): boolean {
        return this.keywords.has(name) || !this.grammarConfig.nameRegexp.test(name);
    }

    /**
     * Backtrack to any token start that have triggered completion request
     * @param text document test
     * @param offset starting search offset (cursor)
     * @returns offset to the potential trigger token start
     */
    protected backtrackToAnyTriggerStart(text: string, offset: number): number {
        if (offset >= text.length) {
            offset = text.length - 1;
        }

        const char = text.charAt(offset);

        if (char === "'") {
            return offset;
        } else {
            // if the trigger token ends with a valid identifier character
            // backtrack only through valid identifier characters, otherwise
            // assume it's a reserved keyword/token with special characters
            const test = ALPHA_NUM.test(text.charAt(offset)) ? ALPHA_NUM : NON_ALPHA_NUM;

            while (offset > 0 && test.test(text.charAt(offset - 1))) {
                offset--;
            }
        }
        return offset;
    }

    /**
     * Backtrack to {@link token}
     * @param text document test
     * @param offset starting search offset
     * @param token token to backtrack to, expects `token.length === 1`
     * @returns the offset at which `text.charAt(offset) === token` if found, 0
     * otherwise
     */
    protected backtrackToToken(text: string, offset: number, token: string): number {
        if (token.length !== 1) return offset;

        if (offset >= text.length) {
            offset = text.length - 1;
        }

        while (offset > 0 && text.charAt(offset) !== token) {
            offset--;
        }

        return offset;
    }

    // TODO: remove since buildCompletionTextEdit is no longer overridden
    protected override completionForKeyword(
        context: CompletionContext,
        keyword: Keyword,
        acceptor: CompletionAcceptor
    ): MaybePromise<void> {
        return super.completionForKeyword(context, keyword, (value) => {
            if (value.label) {
                // skip overridden method so that quotes are not added
                value.textEdit = super.buildCompletionTextEdit(
                    context.document.textDocument,
                    context.offset,
                    value.label,
                    value.label
                );
            }
            acceptor(value);
        });
    }

    protected createMemberCompletionItem(
        member: MembershipMeta,
        name: string
    ): CompletionValueItem {
        return {
            label: name,
            kind: CompletionItemKind.Reference,
            detail: member.element()?.nodeType(),
            sortText: "0",
            labelDetails: {
                description: member.element()?.qualifiedName,
            },
        };
    }
}
