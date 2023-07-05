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
    ConjugatedPortDefinition,
    Element,
    ElementReference,
    FeatureReferenceExpression,
    isElement,
    Membership,
    MembershipReference,
    MetadataAccessExpression,
    NamespaceImport,
    PortDefinition,
    Relationship,
    Type,
} from "../../generated/ast";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { SysMLScopeProvider } from "./scope-provider";
import { SysMLDefaultServices } from "../services";
import { LinkedReferenceInfo, MetamodelBuilder } from "../shared/workspace/metamodel-builder";
import { TypeMap, typeIndex } from "../../model/types";
import { sanitizeName } from "../../model/naming";
import { SysMLConfigurationProvider } from "../shared/workspace/configuration-provider";
import { SysMLNodeDescription } from "../shared/workspace/ast-descriptions";
import { ElementMeta, MembershipMeta, NamespaceMeta, ImportMeta } from "../../model";
import { AliasResolver, streamParents } from "../../utils/scope-util";
import { KeysMatching } from "../../utils/common";
import { SysMLType, SysMLTypeList } from "../sysml-ast-reflection";
import { followAlias } from "../../utils/ast-util";
import { clearArtifacts } from "../../utils";
import { TypedModelDiagnostic } from "../validation";

/**
 * Reference used by SysML services that makes use of knowing that only Elements can be referenced
 */
export interface SysMLReference<T extends Element = Element> extends Reference<T> {
    readonly ref?: T;
    readonly $nodeDescription?: SysMLNodeDescription<T>;
}

// similar to Langium DefaultReference with extended property types
export interface DefaultReference<T extends Element = Element> extends SysMLReference<T> {
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
type LinkMap = { [K in SysMLType]?: LinkFunction<SysMLTypeList[K]> };

const Linkers: LinkMap = {};

function linker<K extends SysMLType>(type: K) {
    return function <T, TK extends KeysMatching<T, LinkFunction<SysMLTypeList[K]>>>(
        _: T,
        __: TK,
        descriptor: PropertyDescriptor
    ): void {
        Linkers[type] = descriptor.value;
    };
}

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

        this.linkFunctions = typeIndex.expandToDerivedTypes(
            Linkers as TypeMap<SysMLTypeList, LinkFunction>
        );
    }

    override async link(
        document: LangiumDocument,
        cancelToken = CancellationToken.None
    ): Promise<void> {
        await this.metamodelBuilder.preLink(undefined, document, cancelToken);

        for (const node of document.astNodes) {
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
    resolveImports(node: NamespaceMeta, document: LangiumDocument): void {
        if (!node.imports) return; // nothing to import

        let index = -1;
        for (const imp of node.imports) {
            ++index;
            const impNode = imp.ast();
            if (!impNode) continue; // nothing imported

            // link reference before accessing it
            const imported = this.linkNode(impNode, document);
            if (!imported) continue;

            const ref = impNode.targetRef;

            if (imp.isRecursive || imp.is(NamespaceImport)) {
                // check that wildcard imports are valid
                const namespace = imported.is(Membership) ? imported.element() : imported;
                if (!namespace) {
                    document.modelDiagnostics.add(imp, <TypedModelDiagnostic<ImportMeta>>{
                        severity: "error",
                        // `namespace` is undefined only if `imported` has been
                        // successfully resolved to an alias
                        message: `Could not find Namespace referenced by ${ref?.$meta.text}`,
                        element: imp,
                        info: {
                            property: "targetRef",
                            index: index,
                        },
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
     * Fully link {@link ref}
     * @param ref element reference node to link
     * @param document document that owns {@link ref}
     * @returns final reference of {@link ref} with aliases resolved or undefined
     */
    @linker(ElementReference)
    linkReference(ref: ElementReference, document: LangiumDocument): ElementMeta | undefined {
        const to = ref.$meta.to;
        // check if already linked
        if (to.cached) return to.target;

        let index = 0;
        for (const type of ref.parts) {
            this.doLink(
                {
                    reference: type as SysMLReference,
                    container: ref,
                    property: "parts",
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
     * Link a {@link FeatureReferenceExpression}
     * @returns the linked expression target or undefined
     */
    @linker(FeatureReferenceExpression)
    linkFeatureReferenceExpression(
        expr: FeatureReferenceExpression,
        document: LangiumDocument
    ): ElementMeta | undefined {
        return this.linkNode(expr.expression, document);
    }

    @linker(MetadataAccessExpression)
    linkMetadataAccessExpression(
        expr: MetadataAccessExpression,
        document: LangiumDocument
    ): ElementMeta | undefined {
        const target = this.linkReference(expr.reference, document);
        if (target) expr.$meta.reference = target;
        return target;
    }

    @linker(Relationship)
    linkRelationship(node: Relationship, document: LangiumDocument): ElementMeta | undefined {
        if (!node.targetRef) return node.target?.$meta;
        const target = this.linkReference(node.targetRef, document);
        node.$meta["setElement"](target);
        return target;
    }

    /**
     * extra member to detect alias chains
     */
    private readonly visitedAliases = new Set<MembershipMeta>();
    @linker(Membership)
    linkMembership(node: Membership, document: LangiumDocument): ElementMeta | undefined {
        const meta = node.$meta;
        if (meta.element()) return meta.element();
        if (this.visitedAliases.has(meta)) return meta.element();

        const root = this.visitedAliases.size === 0;
        this.visitedAliases.add(meta);
        const target = this.linkRelationship(node, document);
        if (root) this.visitedAliases.clear();
        return target;
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
        let description = scope.getElement(name);

        if (!description) {
            return this.createLinkingError(refInfo);
        }

        // make sure the node type matches the rule
        const referenceType = this.reflection.getReferenceType(refInfo);
        let foundType: string = description.type;
        let target: ElementMeta | undefined;
        const node = this.loadAstNode(description) as Element | undefined;
        if (description.type === Membership && referenceType !== Membership) {
            // make sure the alias points to a the required element type aliases
            // always reference named elements anyway so the predicate will
            // always return true anyway
            if (node) {
                target = this.linkMembership(node as Membership, node.$meta.document);
            }
        } else {
            target = node?.$meta;
        }

        container.found[index] = target;
        if (referenceType !== Membership) {
            if (target?.is(Membership)) {
                target = target.element();
            }
        }
        if (referenceType === ConjugatedPortDefinition) {
            if (target?.is(PortDefinition)) {
                target = target.conjugatedDefinition?.element();
            }
        }

        if (target) {
            description = target.description ?? description;
        }

        foundType = target?.nodeType() ?? foundType;
        if (this.reflection.isSubtype(foundType, referenceType)) return description;

        return this.createLinkingError(refInfo, undefined, { found: target, type: foundType });
    }

    override getCandidate(refInfo: SysMLReferenceInfo): SysMLNodeDescription | LinkingError {
        try {
            return this.getCandidateImp(refInfo);
        } catch (err) {
            if (err === "unresolved reference") {
                return <LinkingError>{
                    ...refInfo,
                    message: `Found an unresolved reference with name '${refInfo.reference.$refText}`,
                };
            }
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
        unexpected: { found?: ElementMeta; type?: string } = {}
    ): LinkingError {
        const error = super.createLinkingError(refInfo, targetDescription);
        if (unexpected.type) {
            error.message = error.message.slice(0, -1) + `, instead found ${unexpected.type}`;
        }
        if (unexpected.found) {
            error.message += ` (${unexpected.found.qualifiedName})`;
        }

        if (unexpected.found || unexpected.type) {
            error.message += ".";
        }

        const extra = this.config.get().debug.scopeInLinkingErrors;

        if (!extra || extra === "none") return error;

        if (extra === "types") {
            const context =
                refInfo.index === 0
                    ? this.scopeProvider["getContext"](refInfo.container.$meta) ??
                      refInfo.container.$meta.owner()
                    : refInfo.container.$meta.found[refInfo.index - 1];

            if (!context || context === "error") return error;

            if (context.is(Type))
                error.message += `\n\tMRO: [${context
                    .allTypes(undefined, true)
                    .map((t) => `${t.qualifiedName} [${t.setupState}]`)
                    .join(",\n\t      ")}].`;
            else {
                error.message += `\n\tNS:  [${streamParents(context)
                    .map((m) => (m as ElementMeta).qualifiedName)
                    .join(",\n\t      ")}].`;
            }

            return error;
        }

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
        } else {
            error.message += " No scope found!";
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

        if (index === ref.parts.length - 1) {
            // last element in the chain
            if (resolved?.is(Membership) && ref.$type !== MembershipReference) {
                // only resolve alias if we are not looking for membership
                // reference
                const ast = resolved.ast();
                resolved = ast
                    ? this.linkMembership(ast, resolved.document)
                    : followAlias(resolved);
            }

            // unwrap the found membership if we expect a concrete element
            if (ref.$type !== MembershipReference && resolved?.is(Membership)) {
                resolved = resolved.element();
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

    protected getAliasResolver(): AliasResolver {
        return (n) => {
            const node = n.ast();
            const target = n.element();
            if (!node || target || this.visitedAliases.has(n)) {
                return target;
            }
            return this.linkMembership(node, n.document);
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
            const index = container.parts.indexOf(refInfo.reference);
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
                                index: node.parts.indexOf(reference),
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
        document.astNodes.forEach((node) => {
            if (node.$meta) clearArtifacts(node.$meta);
            if (!isElement(node)) return;

            // the computed children may have also been reset completely, add
            // back children from the scope computation phase
            const children = document.precomputedScopes?.get(node) as
                | MultiMap<AstNode, SysMLNodeDescription>
                | undefined;
            children?.forEach((child) => {
                const meta = child.node?.$meta;
                if (!meta?.is(Membership)) return;
                node.$meta["_memberLookup"].set(child.name, meta);
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
