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
    MetadataAccessExpression,
    NamedArgument,
    Namespace,
    SysMlAstType,
} from "../../generated/ast";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { SysMLScopeProvider } from "./scope-provider";
import { SysMLError } from "../sysml-validation";
import { SysMLDefaultServices } from "../services";
import { LinkedReferenceInfo, MetamodelBuilder } from "../shared/workspace/metamodel-builder";
import { TypeMap, typeIndex } from "../../model/types";
import { sanitizeName } from "../../model/naming";
import { SysMLConfigurationProvider } from "../shared/workspace/configuration-provider";
import { SysMLNodeDescription } from "../shared/workspace/ast-descriptions";
import { AliasMeta, ElementMeta, TypeMeta } from "../../model";
import { AliasResolver, isVisibleWith, Visibility } from "../../utils/scope-util";
import { followAlias } from "../../utils/ast-util";

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

type LinkFunction<T = AstNode> = (node: T, document: LangiumDocument) => ElementMeta | undefined;
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

        const linkers: LinkMap = {
            ElementReference: this.linkReference,
            FeatureChainExpression: this.linkFeatureChainExpression,
            InvocationExpression: this.linkInvocationExpression,
            FeatureReferenceExpression: this.linkFeatureReferenceExpression,
            MetadataAccessExpression: this.linkMetadataAccessExpression,
            NamedArgument: this.namedArgument,
        };
        this.linkFunctions = typeIndex.expandToDerivedTypes(
            linkers as TypeMap<SysMlAstType, LinkFunction>
        );
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
    linkNode(node: AstNode, doc: LangiumDocument): ElementMeta | undefined {
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

        let index = -1;
        for (const imp of node.$meta.imports) {
            ++index;
            const impNode = imp.self();
            if (!impNode || !impNode.importedNamespace) continue; // nothing imported

            // link reference before accessing it
            const imported = this.linkReference(impNode.importedNamespace, document);
            const reference = impNode.importedNamespace.chain.at(-1) as SysMLReference | undefined;
            if (!reference || !imported) continue;
            const importDescription = reference.$nodeDescription;
            if (!importDescription) continue; // could not resolve the reference

            // make sure that referenced element is visible for imports
            if (!isVisibleWith(imported.visibility, Visibility.public)) {
                this.setLinkerError(
                    reference as NonNullReference<Element>,
                    `Cannot import a hidden Namespace named ${reference?.$refText}`
                );
                continue;
            }

            imp.importDescription.set({
                element: imported,
                name: importDescription.name,
                description: importDescription,
            });

            if (imp.kind !== "specific") {
                // check that wildcard imports are valid
                const namespace = imported.is(Alias) ? imported.for.target?.element : imported;
                if (!namespace) {
                    this.importErrors.add(document, {
                        // `namespace` is undefined only if `imported` has been
                        // successfully resolved to an alias
                        message: `Could not find Namespace referenced by ${
                            impNode.importedNamespace.$meta.text ?? reference?.$refText
                        }`,
                        node: impNode,
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
    private readonly visitedAliases = new Set<AliasMeta>();

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
    linkAlias(node: Alias, document: LangiumDocument): ElementMeta | undefined {
        const meta = node.$meta;

        // TODO: surface alias cycles as diagnostics
        if (meta.for.cached || this.visitedAliases.has(meta)) return meta.for.target?.element;

        const root = this.visitedAliases.size === 0;
        this.visitedAliases.add(meta);

        this.linkReference(node.for, document);

        let description = node.for.chain.at(-1)?.$nodeDescription;
        while (isAlias(description?.node)) {
            description = description?.node.for.chain.at(-1)?.$nodeDescription;
        }
        node.$meta.for.set(
            description?.node
                ? {
                      element: description.node.$meta as ElementMeta,
                      name: description.name,
                      description: description as SysMLNodeDescription,
                  }
                : undefined
        );
        if (root) {
            this.visitedAliases.clear();
        }

        return description?.node?.$meta as ElementMeta | undefined;
    }

    /**
     * Fully link {@link ref}
     * @param ref element reference node to link
     * @param document document that owns {@link ref}
     * @returns final reference of {@link ref} with aliases resolved or undefined
     */
    linkReference(ref: ElementReference, document: LangiumDocument): ElementMeta | undefined {
        const to = ref.$meta.to;
        // check if already linked
        if (to.cached) return to.target?.element;

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

        return to.target?.element;
    }

    /**
     * Link a {@link FeatureChainExpression}
     */
    protected linkFeatureChainExpression(
        expr: FeatureChainExpression,
        document: LangiumDocument
    ): ElementMeta | undefined {
        const to = expr.$meta.right;
        if (to.cached) return to.target;

        this.linkInvocationExpression(expr, document);
        const target = expr.$meta.args.at(-1);
        to.set(target?.is(Element) ? target : undefined);
        return to.target;
    }

    /**
     * Link an {@link InvocationExpression}
     * @returns the linked invoked type or undefined
     */
    protected linkInvocationExpression(
        expr: InvocationExpression,
        document: LangiumDocument
    ): ElementMeta | undefined {
        if (expr.type) {
            expr.$meta.type = this.linkReference(expr.type, document) as TypeMeta | undefined;
        }

        const meta = expr.$meta;
        meta.args.length = expr.args.length;
        expr.args.forEach((arg, i) => {
            this.linkNode(arg, document);
            const argMeta = arg.$meta;
            meta.args[i] = argMeta.is(ElementReference) ? argMeta.to.target?.element : argMeta;
        });

        return;
    }

    /**
     * Link a {@link FeatureReferenceExpression}
     * @returns the linked expression target or undefined
     */
    protected linkFeatureReferenceExpression(
        expr: FeatureReferenceExpression,
        document: LangiumDocument
    ): ElementMeta | undefined {
        return this.linkNode(expr.expression, document);
    }

    protected linkMetadataAccessExpression(
        expr: MetadataAccessExpression,
        document: LangiumDocument
    ): ElementMeta | undefined {
        const target = this.linkReference(expr.reference, document);
        expr.$meta.reference = target;
        return target;
    }

    protected namedArgument(arg: NamedArgument, doc: LangiumDocument): ElementMeta | undefined {
        return this.linkReference(arg.name, doc);
    }

    /**
     * @see {@link getCandidate}
     */
    getCandidateImp(refInfo: SysMLReferenceInfo): SysMLNodeDescription | LinkingError {
        const container = refInfo.container.$meta;

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
                if (aliased) foundType = aliased.nodeType();
                else foundType = referenceType; // alias failed to link, leave error on it

                container.found[index] = aliased;
            } else {
                foundType = Alias;
            }
        } else {
            // not an alias
            foundType = description.type;
            container.found[index] = this.loadAstNode(description)?.$meta as
                | ElementMeta
                | undefined;
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
            refInfo.container.$meta,
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
        let resolved = refInfo.reference.ref?.$meta;

        if (index === ref.chain.length - 1) {
            // last element in the chain
            if (resolved?.is(Alias)) {
                const ast = resolved.self();
                resolved = ast ? this.linkAlias(ast, getDocument(ast)) : followAlias(resolved);
            }

            ref.$meta.to.set(
                resolved
                    ? {
                          element: resolved,
                          name: refInfo.reference.$refText,
                          description: refInfo.reference.$nodeDescription,
                      }
                    : undefined
            );
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
            const node = n.self();
            if (!node || this.visitedAliases.has(n)) {
                return n.for.target?.element;
            }
            return this.linkAlias(node, getDocument(node));
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
            node.$meta?.resetToAst(node);
            if (!isElement(node)) return;

            // the computed children may have also been reset completely, add
            // back children from the scope computation phase
            const children = document.precomputedScopes?.get(node) as
                | MultiMap<AstNode, SysMLNodeDescription>
                | undefined;
            children?.forEach((child) => {
                const meta = child.node?.$meta;
                if (!meta) return;
                node.$meta.children.set(child.name, {
                    element: meta,
                    description: child,
                    name: child.name,
                });
            });
        });
        super.unlink(document);
    }

    protected override loadAstNode(nodeDescription: AstNodeDescription): AstNode | undefined {
        const node = super.loadAstNode(nodeDescription);
        if (node && !nodeDescription.node)
            this.metamodelBuilder.preLink(
                node,
                this.langiumDocuments().getOrCreateDocument(nodeDescription.documentUri),
                CancellationToken.None
            );
        return node;
    }
}
