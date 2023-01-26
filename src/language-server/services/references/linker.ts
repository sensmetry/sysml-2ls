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
    AstNode,
    AstNodeDescription,
    CstNode,
    DefaultLinker,
    DocumentState,
    getDocument,
    interruptAndCheck,
    isAstNodeDescription,
    isLinkingError,
    LangiumDocument,
    LinkingError,
    MultiMap,
    Reference,
    ReferenceDescriptionProvider,
    ReferenceInfo,
} from "langium";
import { CancellationToken } from "vscode-languageserver";
import {
    Alias,
    Element,
    ElementReference,
    FeatureChainExpression,
    FeatureReferenceExpression,
    InvocationExpression,
    isAlias,
    isElement,
    Namespace,
    SysMlAstType,
} from "../../generated/ast";
import { isImportable, resolveAlias } from "../../model/util";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { SysMLScopeProvider } from "./scope-provider";
import { SysMLError } from "../sysml-validation";
import { AliasResolver } from "../../utils/ast-util";
import { SysMLDefaultServices } from "../services";
import { LinkedReferenceInfo, MetamodelBuilder } from "../shared/workspace/metamodel-builder";
import { TypeMap, typeIndex } from "../../model/types";
import { sanitizeName } from "../../model/naming";
import { SysMLConfigurationProvider } from "../shared/workspace/configuration-provider";
import { SysMLNodeDescription } from "../shared/workspace/ast-descriptions";

/**
 * Reference used by SysML services that makes use of knowing that only Elements can be referenced
 */
export interface SysMLReference<T extends Element = Element> extends Reference<T> {
    readonly ref?: T;
    readonly $nodeDescription?: SysMLNodeDescription<T>;
}

// similar to Langium DefaultReference with extended property types
interface DefaultReference<T extends Element = Element> extends SysMLReference<T> {
    _ref?: T | LinkingError;
    _nodeDescription?: SysMLNodeDescription<T>;
}

/**
 * Reference that has been successfully linked
 */
export interface NonNullReference<T extends Element = Element> extends SysMLReference<T> {
    readonly ref: T;
}

/**
 * All references are children of ElementReference in this KerML and SysML
 * grammar and only Elements can be referenced
 */
export interface SysMLReferenceInfo extends ReferenceInfo {
    container: ElementReference;
    index: number;
    reference: SysMLReference<Element>;
}

type LinkFunction<T = AstNode> = (node: T, document: LangiumDocument) => Element | undefined;
type LinkMap = { [K in keyof SysMlAstType]?: LinkFunction<SysMlAstType[K]> };

/**
 * Extension of Langium linker to provide SysML specific functionality
 */
export class SysMLLinker extends DefaultLinker {
    protected readonly referenceProvider: ReferenceDescriptionProvider;
    protected readonly indexManager: SysMLIndexManager;
    protected readonly metamodelBuilder: MetamodelBuilder;
    protected override readonly scopeProvider: SysMLScopeProvider;
    protected readonly config: SysMLConfigurationProvider;

    /**
     * Errors found while resolving imports
     */
    protected readonly importErrors = new MultiMap<LangiumDocument, SysMLError>();

    /**
     * Map of document import dependencies
     */
    protected readonly importedDocs: MultiMap<string, string> = new MultiMap<string, string>();

    /**
     * Map of AST node types to specific link functions as link order may be
     * important
     */
    protected readonly linkFunctions: Map<string, LinkFunction>;

    constructor(services: SysMLDefaultServices) {
        super(services);
        this.scopeProvider = services.references.ScopeProvider;
        this.referenceProvider = services.workspace.ReferenceDescriptionProvider;
        this.indexManager = services.shared.workspace.IndexManager;
        this.metamodelBuilder = services.shared.workspace.MetamodelBuilder;
        this.config = services.shared.workspace.ConfigurationProvider;

        this.linkFunctions = typeIndex.expandToDerivedTypes({
            ElementReference: this.linkReference,
            FeatureChainExpression: this.linkFeatureChainExpression,
            InvocationExpression: this.linkInvocationExpression,
            FeatureReferenceExpression: this.linkFeatureReferenceExpression,
        } as LinkMap as TypeMap<SysMlAstType, LinkFunction>);
    }

    override async link(
        document: LangiumDocument,
        cancelToken = CancellationToken.None
    ): Promise<void> {
        // similar to the default but scope affecting references are linked
        // first
        this.importErrors.delete(document);
        await this.metamodelBuilder.preLink(undefined, document, cancelToken);

        for (const node of this.indexManager.stream(document)) {
            await interruptAndCheck(cancelToken);
            this.linkNode(node, document);
        }

        document.state = DocumentState.Linked;
    }

    /**
     * Generically link a specific {@link node}
     * @param node AST node to link
     * @param doc document that contains {@link node}
     * @returns the linked element or undefined
     */
    linkNode(node: AstNode, doc: LangiumDocument): Element | undefined {
        const linker = this.linkFunctions.get(node.$type);
        return linker?.call(this, node, doc);
    }

    /**
     * Link the imports owned by {@link node}
     * @param node namespace node to link imports for
     * @param document document that contains {@link node}
     */
    resolveImports(node: Namespace, document: LangiumDocument): void {
        if (!node.$meta.imports) return; // nothing to import
        const path = document.uri.toString();

        let index = -1;
        for (const imp of node.$meta.imports) {
            ++index;
            if (!imp.importedNamespace) continue; // nothing imported

            // link reference before accessing it
            const imported = this.linkReference(imp.importedNamespace, document);
            const reference = imp.importedNamespace.chain.at(-1) as SysMLReference | undefined;
            if (!reference || !imported) continue;
            const importDescription = reference.$nodeDescription;
            if (!importDescription) continue; // could not resolve the reference

            // make sure that referenced element is visible for imports
            if (!isImportable(imported)) {
                this.setLinkerError(
                    reference as NonNullReference<Element>,
                    `Cannot import a hidden Namespace named ${reference?.$refText}`
                );
                continue;
            }

            try {
                const importedDoc = getDocument(imported);
                if (importedDoc != document)
                    this.importedDocs.add(path, getDocument(imported).uri.toString());
            } catch (Error) {
                // no document, maybe constructed in memory? doesn't affect us
            }

            imp.$meta.importDescription.set(importDescription);

            if (imp.$meta.kind !== "specific") {
                // check that wildcard imports are valid
                const namespace = resolveAlias(imported, isElement);
                if (!namespace) {
                    this.importErrors.add(document, {
                        // `namespace` is undefined only if `imported` has been
                        // successfully resolved to an alias
                        message: `Could not find Namespace referenced by ${
                            imp.importedNamespace.$meta.text ?? reference?.$refText
                        }`,
                        node: imp,
                        property: "importedNamespace",
                        index: index,
                    });
                }
            }
        }
    }

    /**
     * Set linker error {@link value reference}
     * @param value reference to set error on
     * @param message error message
     */
    protected setLinkerError<T extends Element>(value: NonNullReference<T>, message: string): void {
        const ref = value as DefaultReference<T>;
        const error: LinkingError = {
            message: message,
            reference: value,
            container: value.ref.$container,
            property: value.ref.$containerProperty ?? "",
        };
        ref._ref = error;
    }

    /**
     * extra member to detect alias chains
     */
    private readonly visitedAliases = new Set<Alias>();

    /**
     * Recursively link alias references, only useful when resolving imports and
     * relationships prior to {@link DefaultLinker.link}. The
     * {@link DefaultLinker.doLink} is a more robust linking method since it
     * uses the explicitly passed parameters for reference resolution instead of
     * the ones captured by closure early in the parsing which may contain
     * incomplete objects
     * @param node {@link Alias} node to link
     * @returns the final element of {@link Alias} chain or undefined
     */
    linkAlias(node: Alias, document: LangiumDocument): Element | undefined {
        const meta = node.$meta;

        // TODO: surface alias cycles as diagnostics
        if (meta.for.cached || this.visitedAliases.has(node)) return meta.for.target?.node;

        const root = this.visitedAliases.size === 0;
        this.visitedAliases.add(node);

        this.linkReference(node.for, document);

        let description = node.for.chain.at(-1)?.$nodeDescription;
        while (isAlias(description?.node)) {
            description = description?.node.for.chain.at(-1)?.$nodeDescription;
        }
        node.$meta.for.set(description as SysMLNodeDescription);
        if (root) {
            this.visitedAliases.clear();
        }

        return description?.node as Element | undefined;
    }

    /**
     * Fully link {@link ref}
     * @param ref element reference node to link
     * @param document document that owns {@link ref}
     * @returns final reference of {@link ref} with aliases resolved or undefined
     */
    linkReference(ref: ElementReference, document: LangiumDocument): Element | undefined {
        const to = ref.$meta.to;
        // check if already linked
        if (to.cached) return to.target;

        let index = 0;
        for (const type of ref.chain) {
            this.doLink(
                {
                    reference: type as SysMLReference,
                    container: ref,
                    property: "chain",
                    index: index,
                },
                document
            );
            ++index;

            if (!type.ref) return undefined;
        }

        return to.target;
    }

    /**
     * Link a {@link FeatureChainExpression}
     */
    protected linkFeatureChainExpression(
        expr: FeatureChainExpression,
        document: LangiumDocument
    ): Element | undefined {
        const to = expr.$meta.right;
        if (to.cached) return to.target;

        this.linkNode(expr.args[0], document);
        const right = this.linkNode(expr.args[1], document);
        to.set(right);
        return right;
    }

    /**
     * Link an {@link InvocationExpression}
     * @returns the linked invoked type or undefined
     */
    protected linkInvocationExpression(
        expr: InvocationExpression,
        document: LangiumDocument
    ): Element | undefined {
        if (expr.type) return this.linkReference(expr.type, document);
        for (const arg of expr.args) this.linkNode(arg, document);
        return;
    }

    /**
     * Link a {@link FeatureReferenceExpression}
     * @returns the linked expression target or undefined
     */
    protected linkFeatureReferenceExpression(
        expr: FeatureReferenceExpression,
        document: LangiumDocument
    ): Element | undefined {
        return this.linkNode(expr.expression, document);
    }

    /**
     * @see {@link getCandidate}
     */
    getCandidateImp(refInfo: SysMLReferenceInfo): SysMLNodeDescription | LinkingError {
        const container = refInfo.container;

        // check parent scopes in the same document first
        const index = refInfo.index ?? 0;
        const scope = this.scopeProvider.getElementReferenceScope(
            container,
            index,
            this.getAliasResolver()
        );

        if (!scope) {
            return this.createLinkingError(refInfo);
        }

        const name = sanitizeName(refInfo.reference.$refText);
        const description = scope.getElement(name);

        if (!description) {
            return this.createLinkingError(refInfo);
        }

        // make sure the node type matches the rule
        let foundType: string;
        const referenceType = this.reflection.getReferenceType(refInfo);
        if (description.type === Alias) {
            // make sure the alias points to a the required element type aliases
            // always reference named elements anyway so the predicate will
            // always return true anyway
            const alias = this.loadAstNode(description) as Alias | undefined;
            if (alias) {
                const aliased = this.linkAlias(alias, getDocument(alias));
                if (aliased) foundType = aliased.$type;
                else foundType = referenceType; // alias failed to link, leave error on it

                container.$meta.found[index] = aliased;
            } else {
                foundType = Alias;
            }
        } else {
            // not an alias
            foundType = description.type;
            container.$meta.found[index] = this.loadAstNode(description) as Element | undefined;
        }

        if (this.reflection.isSubtype(foundType, referenceType)) return description;

        return this.createLinkingError(refInfo, undefined, { found: description, type: foundType });
    }

    override getCandidate(refInfo: SysMLReferenceInfo): SysMLNodeDescription | LinkingError {
        try {
            return this.getCandidateImp(refInfo);
        } catch (err) {
            if (err instanceof Error) {
                const linkingError: LinkingError = {
                    ...refInfo,
                    message: `An error occurred while resolving reference to '${refInfo.reference.$refText}': ${err}`,
                };
                if (this.config.get().debug.stacktraceInLinkingErrors) {
                    linkingError.message += `\n${err.stack}`;
                }
                return linkingError;
            }
            throw err;
        }
    }

    /**
     * @see {@link DefaultLinker.createLinkingError}
     * @param refInfo info on reference that failed to link
     * @param targetDescription doesn't seem to be used even by langium
     * @param unexpected additional context if a wrong type of element was found
     * @returns the constructed linking error
     */
    protected override createLinkingError(
        refInfo: SysMLReferenceInfo,
        targetDescription?: SysMLNodeDescription | undefined,
        unexpected: { found?: SysMLNodeDescription; type?: string } = {}
    ): LinkingError {
        const error = super.createLinkingError(refInfo, targetDescription);
        if (unexpected.type) {
            error.message = error.message.slice(0, -1) + `, instead found ${unexpected.type}`;
        }
        if (unexpected.found?.node) {
            error.message += ` (${(unexpected.found.node as Element).$meta.qualifiedName})`;
        }

        if (unexpected.found || unexpected.type) {
            error.message += ".";
        }

        if (!this.config.get().debug.scopeInLinkingErrors) return error;

        const scope = this.scopeProvider.getElementReferenceScope(
            refInfo.container,
            refInfo.index,
            this.getAliasResolver()
        );
        if (scope) {
            const names = scope
                .getAllElements()
                .map((d) => `${d.name} [${(d.node as Element).$meta.qualifiedName}]`);
            error.message += `\nScope:\n[\n\t${names.toArray().join(",\n\t")}\n]`;
        }

        return error;
    }

    protected override doLink(
        refInfo: SysMLReferenceInfo,
        document: LangiumDocument<AstNode>
    ): void {
        super.doLink(refInfo, document);

        const ref = refInfo.container;
        const index = refInfo.index;
        let resolved = refInfo.reference.ref;

        if (index === ref.chain.length - 1) {
            // last element in the chain
            if (isAlias(resolved)) {
                resolved = this.linkAlias(resolved, getDocument(resolved));
            }

            ref.$meta.to.set(resolved);
            if (resolved) {
                this.metamodelBuilder.onLinkedReference(
                    ref,
                    refInfo as LinkedReferenceInfo,
                    document
                );
            }
        } else if (resolved) {
            this.metamodelBuilder.onLinkedPart(refInfo as LinkedReferenceInfo, document);
        }
    }

    /**
     * Get import errors related to `document`
     * @param document document
     * @returns Import errors in `document`
     */
    getImportErrors(document: LangiumDocument): readonly SysMLError[] {
        return this.importErrors.get(document);
    }

    protected getAliasResolver(): AliasResolver {
        return (n) => {
            if (this.visitedAliases.has(n)) {
                return n.for.$meta.to.target;
            }
            return this.linkAlias(n, getDocument(n));
        };
    }

    protected override getLinkedNode(refInfo: SysMLReferenceInfo): {
        node?: AstNode | undefined;
        descr?: AstNodeDescription | undefined;
        error?: LinkingError | undefined;
    } {
        // build everything upto the root scope to make sure scope resolution
        // has full information

        // Note: seems the AST node captured by closure can be left in an
        // incomplete state while CST node seems more reliable
        // TODO: fix in Langium
        const container = refInfo.container.$meta
            ? refInfo.container
            : (refInfo.reference.$refNode?.element as ElementReference | undefined);
        if (container) {
            const doc = container.$meta.document;
            if (doc) {
                // first is the ElementReference, second is the real owner
                this.metamodelBuilder.preLink(container.$container, doc, CancellationToken.None);
                this.linkReference(container, doc);
                // should have been linked now, return the linked values
                return {
                    // don't use .ref here so it doesn't accidentally trigger
                    // recursive linking
                    node: refInfo.reference.$nodeDescription?.node,
                    descr: refInfo.reference.$nodeDescription,
                    error: refInfo.reference.error,
                };
            }
            // index also is missing from eager linking...
            // TODO: fix in Langium
            const index = container.chain.indexOf(refInfo.reference);
            if (index >= 0) refInfo.index = index;
        }
        return super.getLinkedNode(refInfo);
    }

    override buildReference(
        node: ElementReference,
        property: string,
        refNode: CstNode | undefined,
        refText: string
    ): Reference<Element> {
        // See behavior description in doc of Linker, update that on changes in here.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const linker = this;
        const reference: DefaultReference<Element> = {
            $refNode: refNode,
            $refText: refText,

            get ref() {
                if (isElement(this._ref)) {
                    // Most frequent case: the target is already resolved.
                    return this._ref;
                } else if (isAstNodeDescription(this._nodeDescription)) {
                    // A candidate has been found before, but it is not loaded yet.
                    // linked node will always be an element, no other node types can be referenced
                    const linkedNode = linker.loadAstNode(this._nodeDescription) as
                        | Element
                        | undefined;
                    this._ref =
                        linkedNode ??
                        linker.createLinkingError(
                            {
                                reference,
                                container: node,
                                property,
                                index: node.chain.indexOf(reference),
                            },
                            this._nodeDescription
                        );
                } else if (this._ref === undefined) {
                    // TODO: fix eager linking and remove this method entirely

                    // Not linked yet. Since eager linking breaks more often
                    // than not it is disabled at least for now. Also node can
                    // stay in an invalid (partial) state
                    return undefined;
                }
                return isElement(this._ref) ? this._ref : undefined;
            },
            get $nodeDescription() {
                return this._nodeDescription;
            },
            get error() {
                return isLinkingError(this._ref) ? this._ref : undefined;
            },
        };
        return reference;
    }

    override unlink(document: LangiumDocument<AstNode>): void {
        // also have to reset the resolved metamodels since they mostly depend
        // on the resolved references
        this.indexManager.stream(document).forEach((node) => {
            node.$meta?.reset();
            if (!isElement(node)) return;

            // the computed children may have also been reset completely, add
            // back children from the scope computation phase
            const children = document.precomputedScopes?.get(node) as
                | MultiMap<AstNode, SysMLNodeDescription>
                | undefined;
            children?.forEach((child) => node.$meta.children.set(child.name, child));
        });
        super.unlink(document);
    }
}
