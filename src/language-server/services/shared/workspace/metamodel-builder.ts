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
    getDocument,
    interruptAndCheck,
    LangiumDocument,
    MultiMap,
    ReferenceInfo,
    ServiceRegistry,
    stream,
} from "langium";
import { CancellationToken, Range } from "vscode-languageserver";
import {
    ElementReference,
    Feature,
    isFeature,
    isType,
    Type,
    Association,
    Connector,
    Namespace,
    Element,
    isElement,
    Usage,
    Definition,
    isClassifier,
    Classifier,
    RequirementUsage,
    ActionUsage,
    ActionDefinition,
    TransitionUsage,
    Metaclass,
    MetadataFeature,
    Comment,
    isMetaclass,
    isElementReference,
    MembershipImport,
    Specialization,
    Subsetting,
    Conjugation,
    TypeFeaturing,
    Redefinition,
    FeatureTyping,
    Expression,
    TransitionFeatureMembership,
    SubjectMembership,
    ObjectiveMembership,
    StateSubactionMembership,
    InvocationExpression,
    OperatorExpression,
    FeatureChaining,
    FeatureReferenceExpression,
    Relationship,
    ReferenceUsage,
    EndFeatureMembership,
    Membership,
} from "../../../generated/ast";
import {
    BasicMetamodel,
    FeatureMeta,
    isMetamodel,
    MetaCtor,
    META_FACTORY,
    ModelLevelExpressionEvaluator,
    TransitionUsageMeta,
    TypeMeta,
    MetadataFeatureMeta,
    FeatureTypingMeta,
    ModelContainer,
    SpecializationMeta,
    MembershipMeta,
    ElementMeta,
    SpecializationKeys,
} from "../../../model";
import { SysMLError } from "../../sysml-validation";
import { SysMLDefaultServices, SysMLSharedServices } from "../../services";
import { SysMLIndexManager } from "./index-manager";
import { TypeMap, typeIndex } from "../../../model/types";
import { implicitIndex } from "../../../model/implicits";
import { TransitionFeatureKind } from "../../../model/enums";
import { NonNullReference, SysMLLinker } from "../../references/linker";
import { KeysMatching, Statistics } from "../../../utils/common";
import {
    ConstructParams,
    SysMLAstReflection,
    SysMLType,
    SysMLTypeList,
} from "../../sysml-ast-reflection";
import { AstParent, AstPropertiesFor, streamAst } from "../../../utils/ast-util";
import { SysMLConfigurationProvider } from "./configuration-provider";
import { URI } from "vscode-uri";

const MetaclassPackages = [
    "KerML::Root::",
    "KerML::Core::",
    "KerML::Kernel::",
    "SysML::Systems::",
    // "SysML::",
] as const;
const MetaclassOverrides: { readonly [K in SysMLType]?: string } = {
    SysMLFunction: "Function", // Function is reserved in TS
};

export interface LinkedReferenceInfo<T extends Element = Element> extends ReferenceInfo {
    reference: NonNullReference<T>;
}

export interface MetamodelBuilder {
    /**
     * Postprocess document after parsing but before indexing.
     * @param document document that was parsed
     */
    onParsed(document: LangiumDocument): void;

    /**
     * Method called on document change, prepare metamodel for relinking
     * @param document document that has changed
     */
    onChanged(document: LangiumDocument): void;

    /**
     * Early linking step for references that affect scope resolution
     * @param node node to link synchronously, if not provided all nodes in
     * {@link document} are linked asynchronously
     * @param document document to prelink or document that contains {@link node}
     * @param cancelToken cancellation token
     */
    preLink(
        node: AstNode | undefined,
        document: LangiumDocument,
        cancelToken: CancellationToken
    ): Promise<void>;

    /**
     * Callback on a fully linked SysML reference
     * @param ref reference container that was just fully linked
     * @param info reference info of the last reference in {@link ref}
     * @param document document that contains {@link ref}
     */
    onLinkedReference(
        ref: ElementReference,
        info: LinkedReferenceInfo,
        document: LangiumDocument
    ): void;

    /**
     * Callback on a linked SysML reference part in the chain
     * @param info Reference that was just linked
     * @param document document that contains {@link info}
     */
    onLinkedPart(info: LinkedReferenceInfo, document: LangiumDocument): void;

    /**
     * Get metamodel errors for {@link document}
     * @param document Document errors apply to
     * @return readonly array of metamodel errors
     */
    getMetamodelErrors(document: LangiumDocument): readonly SysMLError[];
}

class ElementIdProvider {
    private count = 0;

    next(): number {
        // sequential IDs are simple and fast but may not be best if used as
        // hash keys
        return this.count++;
    }
}

// All linking of scope importing references (imports, specializations) has to
// be done recursively unless synchronizing on additional document build stages

type PreLinkFunction<T = AstNode> = [number, (node: T, document: LangiumDocument) => void];
type PreLinkFunctionMap = {
    [K in SysMLType]?: PreLinkFunction<SysMLTypeList[K]>[];
};

const Builders: PreLinkFunctionMap = {};

function builder<K extends SysMLType>(type: K | K[], order = 0) {
    return function <T, TK extends KeysMatching<T, PreLinkFunction<SysMLTypeList[K]>[1]>>(
        _: T,
        __: TK,
        descriptor: PropertyDescriptor
    ): void {
        if (typeof type === "string") type = [type];
        type.forEach((t) => {
            (Builders[t] ??= [] as NonNullable<typeof Builders[K]>).push([order, descriptor.value]);
        });
    };
}

// TODO: maybe should split this into KerML and SysML builders with SysML
// inheriting from KerML builder

/**
 * Builder for KerML and SysML metamodels setting up explicit and implicit
 * relationships
 */
export class SysMLMetamodelBuilder implements MetamodelBuilder {
    protected readonly idProvider = new ElementIdProvider();
    protected readonly indexManager: SysMLIndexManager;
    protected readonly registry: ServiceRegistry;
    protected readonly config: SysMLConfigurationProvider;
    protected readonly astReflection: SysMLAstReflection;
    protected readonly statistics: Statistics;
    protected readonly evaluator: ModelLevelExpressionEvaluator;

    protected readonly metamodelErrors = new MultiMap<string, SysMLError>();
    protected readonly metaFactories: Partial<Record<string, MetaCtor<AstNode>>>;
    protected readonly preLinkFunctions: Map<string, Set<PreLinkFunction<AstNode>[1]>>;

    constructor(services: SysMLSharedServices) {
        this.indexManager = services.workspace.IndexManager;
        this.registry = services.ServiceRegistry;
        this.config = services.workspace.ConfigurationProvider;
        this.astReflection = services.AstReflection;
        this.evaluator = services.modelLevelExpressionEvaluator;
        this.statistics = services.statistics;

        // TODO: these should be computed once and reused between multiple
        // instances of SysML services, testing may be easier by creating new
        // services for each test
        this.metaFactories = META_FACTORY as Record<string, MetaCtor<AstNode>>;

        // using arrays of functions for easier composition, in SysML there are
        // a lot of types that specialize multiple supertypes and declaring
        // functions for each of them separately is tedious, arrays will
        // automatically include all base classes setup functions
        this.preLinkFunctions = this.registerLinkFunctions(Builders);
    }

    protected registerLinkFunctions(
        functions: PreLinkFunctionMap
    ): Map<string, Set<PreLinkFunction[1]>> {
        const map = typeIndex.expandAndMerge(
            functions as TypeMap<SysMLTypeList, PreLinkFunction[]>,
            // merge from supertypes to most derived types
            true
        );

        const retMap = new Map<string, Set<PreLinkFunction[1]>>();
        for (const [type, functions] of map) {
            retMap.set(type, new Set(functions.sort(([a], [b]) => a - b).map(([_, fn]) => fn)));
        }

        return retMap;
    }

    protected linker(uri: URI): SysMLLinker {
        // have to use lazy linker resolution to avoid cyclic dependencies
        return (this.registry.getServices(uri) as SysMLDefaultServices).references.Linker;
    }

    onLinkedPart(info: LinkedReferenceInfo, document: LangiumDocument<AstNode>): void {
        this.preLinkNode(info.reference.ref, document);
    }

    onLinkedReference(ref: ElementReference, _: LinkedReferenceInfo, __: LangiumDocument): void {
        const owner = ref.$container.$meta;
        if (owner.is(MembershipImport)) {
            // importing name only, no need to fully resolve yet
            if (!owner.isRecursive) return;
        } else if (owner.is(Membership) && owner.isAlias()) {
            // importing name only, same as named import
            return;
        }

        const target = ref.$meta.to.target?.ast();
        if (target) this.preLinkNode(target, getDocument(target));
    }

    getMetamodelErrors(document: LangiumDocument<AstNode>): readonly SysMLError[] {
        return this.metamodelErrors.get(document.uriString);
    }

    onParsed(document: LangiumDocument<AstNode>): void {
        // reset the cached nodes in case they are stale
        const children = this.indexManager.stream(document, true);
        for (const child of children) {
            this.addMeta(child, document);
        }

        // second initialization pass
        children.forEach((child) => child.$meta?.initializeFromAst(child));
    }

    onChanged(document: LangiumDocument<AstNode>): void {
        const added: AstNode[] = [];
        for (const child of this.indexManager.stream(document, true)) {
            const meta = child.$meta;
            if (meta) meta.resetToAst(child);
            else {
                this.addMeta(child, document);
                added.push(child);
            }
        }
        added.forEach((child) => child.$meta?.initializeFromAst(child));
    }

    /**
     * Add `$meta` member to {@link child}
     * @param child node to add metamodel member to
     * @param document document containing {@link child}
     */
    protected addMeta(child: AstNode, document: LangiumDocument): void {
        const meta = this.constructMetamodelAst(child);
        child.$meta = meta;
        if (isElementReference(child)) child.$meta.document = document;
    }

    /**
     * Construct appropriate metamodel for {@link node}
     * @param node AST node to construct metamodel for
     * @returns Constructed metamodel
     */
    protected constructMetamodelAst(node: AstNode): BasicMetamodel {
        // @ts-expect-error dealing with reflection
        return this.constructMetamodel(node.$type as SysMLType, node.$container?.$meta);
    }

    constructMetamodel<K extends SysMLType>(
        type: K,
        parent: ModelContainer<SysMLTypeList[K]>
    ): SysMLTypeList[K]["$meta"] {
        const factory = this.metaFactories[type];
        if (!factory) throw new Error(`Invalid type for metamodel: ${type}`);
        return factory(this.idProvider.next(), parent) as SysMLTypeList[K]["$meta"];
    }

    async preLink(
        node: AstNode | undefined,
        document: LangiumDocument<AstNode>,
        cancelToken: CancellationToken
    ): Promise<void> {
        if (node) {
            return this.preLinkNode(node, document);
        }

        this.metamodelErrors.delete(document.uri.toString());

        for (const node of this.indexManager.stream(document)) {
            await interruptAndCheck(cancelToken);
            this.preLinkNode(node, document);
        }
    }

    /**
     * Pre-link method that handles all AST nodes in a generic way
     * @param node node to pre-link
     * @param document document that contains {@link node}
     * @returns
     */
    protected preLinkNode(node: AstNode, document?: LangiumDocument): void {
        const meta = node.$meta;
        // TODO: surface circular dependencies as warnings?
        if (meta?.setupState !== "none") return; // already setting up, avoid infinite recursion

        const debug = this.config.get().debug.linkingTrace && isElement(node);
        if (debug) {
            console.log(
                "  ".repeat(this.statistics.currentDepth),
                `> ${node.$meta.qualifiedName} [${node.$type}]`
            );
        }

        const preprocess = this.preLinkFunctions.get(node.$type);
        meta.setupState = "active";
        document ??= getDocument(node);
        if (preprocess) {
            for (const fn of preprocess) {
                this.statistics.enter(fn.name);

                if (debug) console.log("  ".repeat(this.statistics.currentDepth), fn.name);
                fn.call(this, node, document);

                this.statistics.exit(fn.name);
            }
        }
        meta.setupState = "completed";

        if (debug) {
            console.log(
                "  ".repeat(this.statistics.currentDepth),
                `< ${node.$meta.qualifiedName} [${node.$type}]`
            );
        }
    }

    /**
     * Assign a standard library metaclass based on the AST type
     */
    @builder(Element)
    assignMetaclass(node: Element, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const cache = {
            node,
            document,
            builder: this,
        };

        // Since most elements will never have their metaclasses accessed, use a
        // lazily evaluated property which evaluates and replaces itself on the
        // first access. This way this build step is basically free
        Object.defineProperty(node.$meta, "metaclass", {
            get: (): MetadataFeatureMeta | undefined => {
                const { node, document, builder } = cache;
                const name = MetaclassOverrides[node.$type as SysMLType] ?? node.$type;
                let metaclass: Metaclass | undefined | null;
                for (const pack of MetaclassPackages) {
                    const meta = builder.indexManager.findGlobalElement(
                        pack + name,
                        document,
                        true
                    )?.node;
                    if (isMetaclass(meta)) {
                        metaclass = meta;
                        break;
                    }
                }

                let feature: MetadataFeatureMeta | undefined;
                if (!metaclass) {
                    builder.addError(document, node, `Could not find metaclass for ${name}`);
                } else {
                    // make sure the library metaclass is constructed so that it
                    // can be used in evaluations, important for
                    // SemanticMetadata
                    this.preLinkNode(metaclass);

                    // not assigning to any specific parent property
                    feature = new MetadataFeatureMeta(this.idProvider.next(), node.$meta);
                    feature.annotates.push(node.$meta);
                    const typing = new FeatureTypingMeta(builder.idProvider.next(), feature);
                    typing.setElement(metaclass.$meta);

                    feature.addSpecialization(typing);
                }

                Object.defineProperty(node.$meta, "metaclass", {
                    get: () => feature,
                    configurable: true,
                });

                return feature;
            },
            configurable: true,
        });
    }

    /**
     * Construct a valid AST node at runtime
     * @param properties partial properties matching the AST node
     * @param type type name of the AST node
     * @param document document the constructed node will belong to
     * @returns Constructed and valid AST node with metamodel constructed and initialized
     */
    construct<
        V extends SysMLType,
        T extends AstParent<SysMLTypeList[V]>,
        P extends AstPropertiesFor<SysMLTypeList[V], T>
    >(
        type: V,
        properties: ConstructParams<SysMLTypeList[V], T, P>,
        document: LangiumDocument
    ): SysMLTypeList[V] {
        const node = this.astReflection.createNode(type, properties);
        this.addMeta(node, document);
        // valid document implies that parsed nodes have had $meta assigned so
        // initialize is safe to call
        // cast for better TSC performance...
        (node as AstNode).$meta?.initializeFromAst(node);
        return node;
    }

    /**
     * Resolve imports of {@link node} and its parents since they are implicitly
     * imported
     */
    @builder(Namespace)
    resolveNamespaceImports(node: Namespace, document: LangiumDocument): void {
        const meta = node.$meta;
        // again check for circular dependencies TODO: surface circular
        // dependencies as warnings?
        if (meta.importResolutionState !== "none") return;

        meta.importResolutionState = "active";

        // make sure parent namespace imports are resolved fully
        let parent: AstNode | undefined = node.$container;
        while (parent) {
            this.preLinkNode(parent, document);
            parent = parent.$container;
        }

        this.linker(document.uri).resolveImports(node, document);
        meta.importResolutionState = "completed";

        for (const imp of meta.imports) {
            // if importing by name only dependant scopes don't have to be
            // linked
            if (imp.is(MembershipImport) && !imp.isRecursive) continue;

            const description = imp.element();
            if (!description) continue; // failed to link

            const target = description.ast();
            if (!target) continue; // nothing to resolve

            // link dependant namespaces recursively
            this.preLinkNode(target, getDocument(target));
        }
    }

    @builder(Namespace, 10000)
    linkNamespaceFeatures(node: Namespace, document: LangiumDocument): void {
        // feature elements need to be linked early to resolve implicit naming
        // that may be used to reference them later on
        node.members.forEach((member) => {
            if (member.element && !(member.element.declaredName || member.element.declaredName))
                this.preLinkNode(member.element, document);
        });
    }

    /**
     * Setup explicit feature relationships
     */
    @builder(Feature)
    collectFeatureClassifiers(node: Feature, _document: LangiumDocument): void {
        node.$meta.allTypes().forEach((t) => (node.$meta.classifier |= t.classifier));
    }

    /**
     * Setup implicit specializations from Metaobjects::SemanticMetadata
     */
    @builder(Type)
    addSemanticMetadata(node: Type, document: LangiumDocument): void {
        for (const metadata of node.$meta.metadata) {
            const metaNode = metadata.ast();
            if (metaNode) this.buildNode(metaNode, document);
            const baseTypes = metadata
                .allFeatures()
                .filter((f) => f.element()?.conforms("Metaobjects::SemanticMetadata::baseType"));

            for (const member of baseTypes) {
                const baseType = member.element();
                if (!baseType) continue;
                const value = baseType.value?.element();
                if (!value) continue;

                const expr = value.ast();
                if (expr) this.buildNode(expr, document);
                const result = this.evaluator.evaluate(value, baseType)?.at(0);
                if (!result || !isMetamodel(result) || !result.is(MetadataFeature)) continue;

                for (const annotated of result.annotates) {
                    if (!annotated.is(Type)) continue;
                    const specialization = this.constructMetamodel(
                        node.$meta.specializationKind(),
                        node.$meta
                    ) as SpecializationMeta;
                    specialization.isImplied = true;
                    specialization.setElement(annotated);
                    node.$meta.addSpecialization(specialization);
                }
            }
        }
    }

    @builder([Specialization, Conjugation], 100)
    setupSpecialization(node: Specialization | Conjugation, document: LangiumDocument): void {
        node.chains.forEach((f) => this.preLinkNode(f, document));
        let source: ElementMeta | undefined = node.$meta.source();
        if (!node.reference) {
            node.$meta.setElement(node.chains.at(-1)?.$meta.chainings.at(-1)?.element());
        }
        if (!node.source && node.chains.length === (node.reference ? 1 : 2)) {
            source = node.chains[0].$meta.chainings.at(-1)?.element();
            if (source) node.$meta.setSource(source);
        }

        if (!source?.is(Type)) return;
        source.addSpecialization(node.$meta);
    }

    /**
     * Setup explicit type relationships
     */
    @builder(Type)
    linkTypeRelationships(node: Type, document: LangiumDocument): void {
        // explicit
        node.typeRelationships.forEach((r) => this.preLinkNode(r, document));
    }

    @builder(FeatureChaining)
    linkFeatureChaining(node: FeatureChaining, _document: LangiumDocument): void {
        (node.$container.$meta as FeatureMeta).chainings.push(node.$meta);
    }

    /**
     * Setup implicit classifier relationships
     */
    @builder(Classifier)
    addClassifierImplicits(node: Classifier, document: LangiumDocument): void {
        // implicit
        if (node.$meta.specializations().some((r) => r.is(Specialization) && !r.isImplied)) return;
        this.addImplicits(node, document, isType);
    }

    /**
     * Setup implicit feature relationships
     */
    @builder(Feature)
    addFeatureImplicits(node: Feature, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        // implicit
        if (
            !node.typeRelationships.some((r) => r.$meta.is(TypeFeaturing)) &&
            !isType(node.$container)
        ) {
            const anything = this.findLibraryElement(
                node,
                "Base::Anything",
                document,
                isType,
                "Could not find implicit featuring type"
            );
            if (anything) {
                node.$meta.featuredBy.add(anything.$meta);
                // TODO: featuredBy should add this node as child
            }
        }

        if (node.typeRelationships.some((r) => r.$meta.isAny([Subsetting, Conjugation]))) return;

        // no explicit specializations
        this.addImplicits(node, document, isFeature);
    }

    /**
     * Setup implicit Association and Connector end feature redefinitions
     * @param node
     */
    @builder([Association, Connector], 1000)
    redefineEnds(node: Association | Connector): void {
        const baseEndIterator = node.$meta
            .basePositionalFeatures(
                (f) => f.is(EndFeatureMembership) || !!f.element()?.isEnd,
                (t) => t.is(Association)
            )
            .iterator();

        stream(node.$meta.features)
            .filter((member) => member.is(EndFeatureMembership) || member.element()?.isEnd)
            .map((f) => f.element())
            .nonNullable()
            .forEach((end) => {
                const ast = end.ast();
                if (
                    (ast && ast.typeRelationships.some((r) => r.$meta.is(Redefinition))) ||
                    (!ast && end.specializations(Redefinition).length > 0)
                )
                    return; // no implicit end redefinition
                const base = baseEndIterator.next();
                if (base.done) return;

                // not prelinking the child elements to hide implicit
                // redefinitions
                const specialization = this.constructMetamodel(Redefinition, end);
                specialization.isImplied = true;
                specialization.setElement(base.value.element());
                end.addSpecialization(specialization);
                return;
            });
    }

    /**
     * Setup implicit definition relationships
     */
    @builder(Definition)
    addDefinitionImplicits(node: Definition, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const base = this.findLibraryElement(
            node,
            implicitIndex.get(node.$type as SysMLType, node.$meta.defaultSupertype()),
            document,
            isClassifier,
            `Could not find implicit definition specialization for ${node.$type}`
        );

        if (base && node !== base && !node.$meta.allTypes().includes(base.$meta)) {
            const specialization = this.constructMetamodel(FeatureTyping, node.$meta);
            specialization.isImplied = true;
            specialization.setElement(base.$meta);
            node.$meta.addSpecialization(specialization);
        }
    }

    /**
     * Setup implicit usage relationships
     */
    @builder(Usage)
    addUsageImplicits(node: Usage, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const base = this.findLibraryElement(
            node,
            implicitIndex.get(node.$type as SysMLType, node.$meta.defaultSupertype()),
            document,
            isFeature,
            `Could not find implicit usage specialization for ${node.$type}`
        );

        if (base && node !== base && !node.$meta.allTypes().includes(base.$meta)) {
            const specialization = this.constructMetamodel(Subsetting, node.$meta);
            specialization.isImplied = true;
            specialization.setElement(base.$meta);
            node.$meta.addSpecialization(specialization);
        }
    }

    /**
     * Setup implicit action parameter redefinitions
     */
    @builder([ActionUsage, ActionDefinition], 1000)
    redefineActionParameters(
        action: ActionUsage | ActionDefinition,
        document: LangiumDocument
    ): void {
        const baseActions = action.$meta
            .specializationsMatching([ActionUsage, ActionDefinition])
            .toArray();

        if (baseActions.length === 0) return; // no action typings

        const isParameter = (f: FeatureMeta): boolean => f.direction !== "none";
        const ownedParameters = stream(action.$meta.features)
            .map((member) => member.element())
            .nonNullable()
            .filter(isParameter);
        const baseParameterIterators = baseActions.map((action) =>
            stream(action.element()?.features ?? [])
                .map((member) => member.element())
                .nonNullable()
                .filter(isParameter)
                .iterator()
        );

        for (const parameter of ownedParameters) {
            const node = parameter.ast();
            let explicit: boolean;
            if (node) {
                this.preLinkNode(node, document);
                explicit = node.typeRelationships.some((r) => r.$meta.is(Redefinition));
            } else {
                explicit = parameter.specializations(Redefinition).length > 0;
            }

            // can't continue if redefines explicitly, have to advance iterators
            for (const baseIter of baseParameterIterators) {
                const baseParameter = baseIter.next();

                // don't add implicit redefinition if there is an explicit one
                // already
                if (baseParameter.done || explicit) continue;

                const specialization = this.constructMetamodel(Redefinition, parameter);
                specialization.isImplied = true;
                specialization.setElement(baseParameter.value);
                parameter.addSpecialization(specialization);
            }
        }
    }

    /**
     * Setup implicit subject parameter redefinition
     */
    @builder(ReferenceUsage, 1000)
    redefineSubject(node: ReferenceUsage, _document: LangiumDocument): void {
        const meta = node.$meta;
        if (!meta.parent().is(SubjectMembership)) return;
        this.redefineFirstIf(meta, (member) => {
            return member.is(SubjectMembership) && !!member.element()?.is(Usage);
        });
    }

    /**
     * Setup implicit objective parameter redefinition
     */
    @builder(RequirementUsage)
    redefineObjective(node: RequirementUsage, _document: LangiumDocument): void {
        const meta = node.$meta;
        if (!meta.parent().is(ObjectiveMembership)) return;
        this.redefineFirstIf(meta, (member) => {
            return member.is(ObjectiveMembership) && !!member.element()?.is(RequirementUsage);
        });
    }

    /**
     * Setup implicit state subactions redefinitions
     */
    @builder(ActionUsage, 1000)
    redefineStateSubactions(node: ActionUsage, _document: LangiumDocument): void {
        const meta = node.$meta;
        const parent = meta.parent();
        if (!parent.is(StateSubactionMembership)) return;
        this.redefineFirstIf(meta, (member) => {
            return (
                member.is(StateSubactionMembership) &&
                member.kind === parent.kind &&
                !!member.element()?.is(ActionUsage)
            );
        });
    }

    /**
     * Setup implicit transition usage feature redefinitions
     */
    @builder(TransitionUsage, 1000)
    redefineTransitionUsageFeatures(node: TransitionUsage, document: LangiumDocument): void {
        const collect = (
            type: TypeMeta,
            out: Partial<Record<TransitionFeatureKind, FeatureMeta>>
        ): number => {
            let found = 0;
            type.features.forEach((m) => {
                if (!m.is(TransitionFeatureMembership) || m.kind in out) return;
                out[m.kind] = m.element();
                found++;
            });

            return found;
        };

        const findBases = (
            node: TransitionUsageMeta,
            out: Partial<Record<TransitionFeatureKind, FeatureMeta>>
        ): number => {
            let found = 0;
            for (const specialization of node.typesMatching(TransitionUsage)) {
                found += collect(specialization, out);
                if (found === 3) return found;
            }

            for (const specialization of node.typesMatching(TransitionUsage)) {
                found = findBases(specialization, out);
                if (found === 3) return found;
            }

            return found;
        };

        const bases: Partial<Record<TransitionFeatureKind, FeatureMeta>> = {};
        findBases(node.$meta, bases);

        const owned: Partial<Record<TransitionFeatureKind, FeatureMeta>> = {};
        collect(node.$meta, owned);

        const redefine = (k: TransitionFeatureKind, fallback: string): void => {
            const current = owned[k];
            if (!current) return;
            let feature = bases[k];
            if (!feature) {
                feature = this.findLibraryElement(
                    node,
                    fallback,
                    document,
                    isFeature,
                    "Could not find implicit redefinition"
                )?.$meta;
            }
            if (feature) {
                const specialization = this.constructMetamodel(Redefinition, current);
                specialization.isImplied = true;
                specialization.setElement(feature);
                current.addSpecialization(specialization);
            }
        };

        redefine("trigger", "Actions::TransitionAction::accepter");
        redefine("guard", "TransitionPerformances::TransitionPerformance::guard");
        redefine("effect", "Actions::TransitionAction::effect");
    }

    /**
     * Setup explicit comment references
     */
    @builder(Comment)
    linkComment(node: Comment, document: LangiumDocument): void {
        const linker = this.linker(document.uri);
        node.about.forEach((ref) => {
            const target = ref.annotatedElement;
            if (!target) return;
            const element = linker.linkReference(target, document);
            if (element) {
                node.$meta.annotates.push(element);
                element.comments.push(node.$meta);
            }
        });
    }

    /**
     * Setup explicit metadata references
     */
    @builder(MetadataFeature)
    linkMetadata(node: MetadataFeature, document: LangiumDocument): void {
        const linker = this.linker(document.uri);
        node.about.forEach((ref) => {
            const target = ref.annotatedElement;
            if (!target) return;
            const element = linker.linkReference(target, document);
            if (element) {
                node.$meta.annotates.push(element);
                element.metadata.push(node.$meta);
            }
        });
    }

    /**
     * Setup implicit feature typings from assigned values
     */
    @builder(Feature)
    addFeatureValueTypings(node: Feature, document: LangiumDocument): void {
        const expression = node.value?.element as Expression | undefined;
        if (
            !expression ||
            node.$meta.direction !== "none" ||
            node.$meta.specializations().some((s) => !s.isImplied)
        )
            return;

        this.buildNode(expression, document);
        const type = this.findType(node, expression.$meta.returnType(), document);
        if (!type || !type.is(Feature)) return;

        const specialization = this.constructMetamodel(Subsetting, node.$meta);
        specialization.isImplied = true;
        specialization.setElement(type);
        node.$meta.addSpecialization(specialization);

        // TODO: feature write performance / binding connector as in spec
    }

    @builder(InvocationExpression)
    setupInvocationArgs(node: InvocationExpression, document: LangiumDocument): void {
        node.$children.forEach((m) => this.preLinkNode(m, document));
        node.$meta.args = stream(node.members)
            .map((m) => m.$meta.element() as FeatureMeta | undefined)
            .toArray();
    }

    @builder(OperatorExpression)
    setupOperatorArgs(node: OperatorExpression, _document: LangiumDocument): void {
        node.$meta.args = node.operands
            .map((e) => e.$meta as FeatureMeta | undefined)
            .concat(node.$meta.args);
    }

    @builder(FeatureReferenceExpression)
    linkFeatureReferenceExpression(
        node: FeatureReferenceExpression,
        document: LangiumDocument
    ): void {
        this.preLinkNode(node.expression, document);
    }

    @builder(Relationship, -1000)
    linkRelationship(node: Relationship, document: LangiumDocument): void {
        if (node.reference)
            node.$meta.setElement(
                this.linker(document.uri).linkReference(node.reference, document)
            );
        else node.$meta.setElement(node.element?.$meta);

        if (node.source) {
            const source = this.linker(document.uri).linkReference(node.source, document);
            if (source) node.$meta.setSource(source);
        }
    }

    /**
     * Construct the node fully by linking all its children and optionally specialized types
     * @param node AST node to construct
     * @param document document that owns {@link node}
     * @param specializations if true, also construct base types
     */
    protected buildNode(node: AstNode, document: LangiumDocument, specializations = true): void {
        const linker = this.linker(document.uri);
        for (const child of streamAst(node)) {
            this.preLinkNode(child, document);
            linker.linkNode(child, document);
        }

        if (!isType(node) || !specializations) return;
        node.$meta.allTypes().forEach((t) => {
            const type = t.ast();
            if (type && type !== node) this.buildNode(type, getDocument(type), false);
        });
    }

    /**
     * Find a specified library type by a simple name lookup
     * @param node context node
     * @param type qualified name of the type or the type itself
     * @param document document that owns {@link node}
     * @returns Type if found, undefined otherwise
     */
    protected findType(
        node: AstNode,
        type: string | TypeMeta | undefined,
        document: LangiumDocument
    ): TypeMeta | undefined {
        if (!type) return;
        if (typeof type !== "string") return type;
        return this.findLibraryElement(node, type, document, isType, "Could not find library type")
            ?.$meta;
    }

    /**
     * Add a metamodel error
     * @param document Document this error applies to
     * @param node Context node
     * @param message Error message
     */
    protected addError(document: LangiumDocument, node: AstNode, message: string): void {
        this.metamodelErrors.add(document.uri.toString(), {
            node: node,
            message: message,
            range: node.$cstNode?.range ?? EMPTY_RANGE,
        });
    }

    /**
     * Find a specific library element via name lookup that matches a type predicate {@link is}
     * @param node context node
     * @param qualifiedName qualified type name
     * @param document document that owns {@link node}
     * @param is type check function
     * @param notFoundMessage message in case an element satisfying {@link is} was not found
     * @returns Element satisfying {@link is} if found and undefined otherwise
     */
    protected findLibraryElement<T extends AstNode>(
        node: AstNode,
        qualifiedName: string,
        document: LangiumDocument,
        is: (item: unknown) => item is T,
        notFoundMessage: string
    ): T | undefined {
        const element = this.indexManager.findGlobalElement(qualifiedName, document, true)?.node;
        if (!is(element)) {
            this.addError(document, node, `${notFoundMessage} '${qualifiedName}'`);
            return;
        }

        this.preLinkNode(element);
        return element;
    }

    /**
     * Helper function that collects implicit base types for {@link node}
     * @param node Element to collect base types for
     * @param document document that owns {@link node}
     * @returns qualified names of implicit base types
     */
    protected getImplicitSpecializations(node: Element, document: LangiumDocument): string[] {
        const names: string[] = [];

        for (const kind of node.$meta.defaultGeneralTypes()) {
            const implicitName = implicitIndex.get(node.$type as SysMLType, kind);

            if (!implicitName) {
                this.addError(
                    document,
                    node,
                    `Could not find implicit specialization for ${node.$type} (${kind})`
                );
                continue;
            }

            names.push(implicitName);
        }

        return names;
    }

    /**
     * Setup implicit base types for {@link node}
     * @param node {@link Type} to add implicit specialization to
     * @param document document that owns  {@link node}
     * @param type type assertion for valid specialization types
     */
    protected addImplicits<V extends Type, T extends V>(
        node: T,
        document: LangiumDocument,
        type: (node: unknown) => node is V
    ): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const kind = node.$meta.specializationKind();
        for (const name of this.getImplicitSpecializations(node, document)) {
            if (!name) {
                continue;
            }
            const implicit = this.findLibraryElement(
                node,
                name,
                document,
                type,
                `Could not find implicit specialization for ${kind}`
            );
            if (implicit && implicit !== node) {
                const specialization = this.constructMetamodel(
                    kind,
                    node.$meta
                ) as SpecializationMeta;
                specialization.isImplied = true;
                specialization.setElement(implicit.$meta);
                node.$meta.addSpecialization(specialization);
            }
        }
    }

    /**
     * Redefine the first positional feature satisfying {@link predicate}
     * @param node owner node
     * @param key key of the feature array
     * @param predicate matcher
     * @param document document that owns {@link node}
     */
    protected redefineFirstIf<T extends SpecializationKeys>(
        feature: FeatureMeta,
        predicate: (member: MembershipMeta<FeatureMeta>) => boolean,
        kind?: T
    ): void {
        const owner = feature.owner() as TypeMeta;
        for (const type of owner.allTypes(kind)) {
            const baseFeature = type.features.find(predicate)?.element();
            if (!baseFeature) continue;
            const specialization = this.constructMetamodel(Redefinition, feature);
            specialization.isImplied = true;
            specialization.setElement(baseFeature);
            feature.addSpecialization(specialization);
            return;
        }
    }
}

const EMPTY_RANGE: Range = {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
};
