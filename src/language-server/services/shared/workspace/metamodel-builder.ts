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
    isImport,
    isAlias,
    Usage,
    Definition,
    isClassifier,
    Classifier,
    CaseDefinition,
    CaseUsage,
    RequirementUsage,
    RequirementDefinition,
    ActionUsage,
    ActionDefinition,
    StateUsage,
    StateDefinition,
    TransitionUsage,
    Metaclass,
    MetadataFeature,
    Comment,
    isMetaclass,
    isElementReference,
    Relationship,
} from "../../../generated/ast";
import {
    BasicMetamodel,
    Related,
    FeatureMeta,
    isMetamodel,
    MetaCtor,
    META_FACTORY,
    ModelLevelExpressionEvaluator,
    TransitionUsageMeta,
    TypeMeta,
    MetadataFeatureMeta,
} from "../../../model";
import { SysMLError } from "../../sysml-validation";
import { SysMLDefaultServices, SysMLSharedServices } from "../../services";
import { SysMLIndexManager } from "./index-manager";
import { TypeMap, typeIndex } from "../../../model/types";
import { implicitIndex } from "../../../model/implicits";
import {
    SpecializationKind,
    getSpecializationKind,
    StateSubactionKind,
    getSpecializationKindString,
} from "../../../model/enums";
import { NonNullReference, SysMLLinker } from "../../references/linker";
import { getExplicitSpecializations } from "../../../model/containers";
import { KeysMatching, RecordKey, Statistics } from "../../../utils/common";
import {
    ConstructParams,
    SysMLAstReflection,
    SysMLType,
    SysMLTypeList,
} from "../../sysml-ast-reflection";
import {
    AstParent,
    AstPropertiesFor,
    followAlias,
    followAstAlias,
    streamAst,
} from "../../../utils/ast-util";
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
    ConnectorEnd: Feature,
    InitialNode: Feature,
    SysMLFunction: "Function", // Function is reserved in TS
    Alias: Relationship, // no explicit Alias metaclass in KerML
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

type PreLinkFunction<T = AstNode> = (node: T, document: LangiumDocument) => void;
type PreLinkFunctionMap = {
    [K in SysMLType]?: PreLinkFunction<SysMLTypeList[K]>[];
};

const Builders: PreLinkFunctionMap = {};

function builder<K extends SysMLType>(...type: K[]) {
    return function <T, TK extends KeysMatching<T, PreLinkFunction<SysMLTypeList[K]>>>(
        _: T,
        __: TK,
        descriptor: PropertyDescriptor
    ): void {
        type.forEach((t) => {
            (Builders[t] ??= [] as NonNullable<typeof Builders[K]>).push(descriptor.value);
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
    protected readonly preLinkFunctions: Map<string, Set<PreLinkFunction<AstNode>>>;

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
    ): Map<string, Set<PreLinkFunction>> {
        const map = typeIndex.expandAndMerge(
            functions as TypeMap<SysMLTypeList, PreLinkFunction[]>,
            // merge from supertypes to most derived types
            true
        );

        const retMap = new Map();
        for (const [type, functions] of map) {
            retMap.set(type, new Set(functions));
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
        const owner = ref.$container;
        if (isImport(owner)) {
            // importing name only, no need to fully resolve yet
            if (owner.$meta.kind === "specific") return;
        }

        if (isAlias(owner)) {
            // importing name only, same as named import
            return;
        }

        const target = ref.$meta.to.target?.element.self();
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
        const meta = this.constructMetamodel(child);
        child.$meta = meta;
        if (isElementReference(child)) child.$meta.document = document;
    }

    /**
     * Construct appropriate metamodel for {@link node}
     * @param node AST node to construct metamodel for
     * @returns Constructed metamodel
     */
    protected constructMetamodel(node: AstNode): BasicMetamodel {
        const factory = this.metaFactories[node.$type];
        if (!factory) throw new Error(`Invalid type for metamodel: ${node.$type}`);
        return factory(this.idProvider.next(), node.$container?.$meta);
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
                    feature.addSpecialization(
                        metaclass.$meta,
                        SpecializationKind.Typing,
                        "explicit"
                    );
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
            if (imp.kind === "specific") continue;

            const description = imp.importDescription.target;
            if (!description) continue; // failed to link

            const target = description.element.self();
            if (!target) continue; // nothing to resolve

            // link dependant namespaces recursively
            this.preLinkNode(target, getDocument(target));
        }
    }

    /**
     * Setup explicit feature relationships
     */
    @builder(Feature)
    linkFeatureRelationships(node: Feature, document: LangiumDocument): void {
        const linker = this.linker(document.uri);
        node.chains.forEach((ref) => {
            const element = linker.linkReference(ref, document);
            if (!element) return;
            const first = ref.chain[ref.$meta.featureIndices[0]].ref;
            if (first) {
                // first feature in the chain is the featuring type of the
                // owning feature
                const firstFeature = followAstAlias(first) as Feature | undefined;
                if (firstFeature) {
                    for (const featuringRef of firstFeature.featuredBy) {
                        const featuring = featuringRef.$meta.to.target;
                        if (!featuring) continue;
                        node.$meta.featuredBy.add(featuring.element);
                        element.addChild({ element: node.$meta });
                    }
                }
            }

            const last = followAlias(element) as FeatureMeta | undefined;
            if (!last) return;
            // last feature in the chain is the featured type of the owning
            // feature
            last.featuredBy.add(node.$meta);
            node.$meta.addChild({ element: last });
        });

        node.featuredBy.forEach((ref) => {
            const element = linker.linkReference(ref, document);
            if (!element) return;
            node.$meta.featuredBy.add(element as TypeMeta);
            (element as TypeMeta).addChild({ element: node.$meta });
        });

        node.$meta.allTypes().forEach((t) => (node.$meta.classifier |= t.classifier));
    }

    /**
     * Setup implicit specializations from Metaobjects::SemanticMetadata
     */
    @builder(Type)
    addSemanticMetadata(node: Type, document: LangiumDocument): void {
        for (const metadata of node.$meta.metadata) {
            const metaNode = metadata.element.self();
            if (metaNode) this.buildNode(metaNode, document);
            const baseTypes = metadata.element
                .allFeatures()
                .filter((f) => f.element.conforms("Metaobjects::SemanticMetadata::baseType"));

            for (const baseType of baseTypes) {
                const value = baseType.element.value?.element;
                if (!value) continue;

                const expr = value.self();
                if (expr) this.buildNode(expr, document);
                const result = this.evaluator.evaluate(value, baseType.element)?.at(0);
                if (!result || !isMetamodel(result) || !result.is(MetadataFeature)) continue;

                for (const annotated of result.annotates) {
                    if (!annotated.is(Type)) continue;
                    node.$meta.addSpecialization(
                        annotated,
                        node.$meta.specializationKind(),
                        "implicit"
                    );
                }
            }
        }
    }

    /**
     * Setup explicit type relationships
     */
    @builder(Type)
    linkTypeRelationships(node: Type, document: LangiumDocument): void {
        // explicit
        const linker = this.linker(document.uri);
        getExplicitSpecializations(node).forEach((ref) => {
            const element = linker.linkReference(ref, document);
            if (element)
                node.$meta.addSpecialization(
                    element as TypeMeta,
                    getSpecializationKind(ref),
                    "explicit"
                );
        });
    }

    /**
     * Setup implicit classifier relationships
     */
    @builder(Classifier)
    addClassifierImplicits(node: Classifier, document: LangiumDocument): void {
        // implicit
        if (node.specializes.length !== 0) return;
        this.addImplicits(node, document, isType);
    }

    /**
     * Setup implicit feature relationships
     */
    @builder(Feature)
    addFeatureImplicits(node: Feature, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        // implicit
        if (node.featuredBy.length === 0 && !isType(node.$container)) {
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

        if (
            node.subsets.length !== 0 ||
            node.redefines.length !== 0 ||
            node.conjugates.length !== 0
        )
            return;

        // no explicit specializations
        this.addImplicits(node, document, isFeature);
    }

    /**
     * Setup implicit Association and Connector end feature redefinitions
     * @param node
     */
    @builder(Association, Connector)
    redefineEnds(node: Association | Connector): void {
        const baseEndIterator = node.$meta
            .basePositionalFeatures(
                (f) => f.element.isEnd,
                (t) => t.is(Association)
            )
            .iterator();

        stream(node.$meta.features)
            .map((f) => f.element)
            .filter((f) => f.isEnd)
            .forEach((end) => {
                const ast = end.self();
                if (
                    (ast && ast.redefines.length > 0) ||
                    (!ast && end.specializations(SpecializationKind.Redefinition).length > 0)
                )
                    return; // no implicit end redefinition
                const base = baseEndIterator.next();
                if (base.done) return;

                // not prelinking the child elements to hide implicit
                // redefinitions
                end.addSpecialization(
                    base.value.element,
                    SpecializationKind.Redefinition,
                    "implicit"
                );
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
            node.$meta.addSpecialization(base.$meta, SpecializationKind.Typing, "implicit");
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
            node.$meta.addSpecialization(base.$meta, SpecializationKind.Subsetting, "implicit");
        }
    }

    /**
     * Setup implicit action parameter redefinitions
     */
    @builder(ActionUsage, ActionDefinition)
    redefineActionParameters(
        action: ActionUsage | ActionDefinition,
        document: LangiumDocument
    ): void {
        const baseActions = action.$meta
            .specializationsMatching([ActionUsage, ActionDefinition])
            .toArray();

        if (baseActions.length === 0) return; // no action typings

        const isParameter = (f: Related<FeatureMeta>): boolean => f.element.direction !== "none";
        const ownedParameters = action.$meta.features.filter(isParameter);
        const baseParameterIterators = baseActions.map((action) =>
            stream(action.type.features).filter(isParameter).iterator()
        );

        for (const parameter of ownedParameters) {
            const node = parameter.element.self();
            let explicit: boolean;
            if (node) {
                this.preLinkNode(node, document);
                explicit = node.redefines.length > 0;
            } else {
                explicit =
                    parameter.element.specializations(SpecializationKind.Redefinition).length > 0;
            }

            // can't continue if redefines explicitly, have to advance iterators
            for (const baseIter of baseParameterIterators) {
                const baseParameter = baseIter.next();

                // don't add implicit redefinition if there is an explicit one
                // already
                if (baseParameter.done || explicit) continue;

                parameter.element.addSpecialization(
                    baseParameter.value.element,
                    SpecializationKind.Redefinition,
                    "implicit"
                );
            }
        }
    }

    /**
     * Setup implicit subject parameter redefinition
     */
    @builder(CaseUsage, CaseDefinition, RequirementDefinition, RequirementUsage)
    redefineSubject(
        node: CaseUsage | CaseDefinition | RequirementDefinition | RequirementUsage,
        document: LangiumDocument
    ): void {
        this.redefineFirstIf({
            node,
            key: "features",
            predicate: (f) => f.element.is(Usage) && f.element.isSubjectParameter,
            document,
        });
    }

    /**
     * Setup implicit objective parameter redefinition
     */
    @builder(CaseUsage, CaseDefinition)
    redefineObjective(node: CaseUsage | CaseDefinition, document: LangiumDocument): void {
        this.redefineFirstIf({
            node,
            key: "features",
            predicate: (f) =>
                f.element.is(RequirementUsage) && f.element.requirementKind === "objective",
            document,
        });
    }

    /**
     * Setup implicit state subactions redefinitions
     */
    @builder(StateUsage, StateDefinition)
    redefineStateSubactions(node: StateUsage | StateDefinition, document: LangiumDocument): void {
        const redefine = (kind: StateSubactionKind): void => {
            this.redefineFirstIf({
                node,
                key: "subactions",
                predicate: (f) =>
                    f.element.is(ActionUsage) && f.element.stateSubactionKind === kind,
                document,
            });
        };

        redefine("do");
        redefine("entry");
        redefine("exit");
    }

    /**
     * Setup implicit transition usage feature redefinitions
     */
    @builder(TransitionUsage)
    redefineTransitionUsageFeatures(node: TransitionUsage, document: LangiumDocument): void {
        type K = KeysMatching<TransitionUsage, Feature | undefined>;
        const findBase = (node: TransitionUsageMeta, k: K): Feature | undefined => {
            for (const specialization of node.typesMatching(TransitionUsage)) {
                const node = specialization.self();
                if (node && node[k]) return node[k];
            }

            for (const specialization of node.typesMatching(TransitionUsage)) {
                const feature = findBase(specialization, k);
                if (feature) return feature;
            }

            return;
        };

        const redefine = (k: K, fallback: string): void => {
            const current = node[k];
            if (!current) return;
            let feature = findBase(node.$meta, k);
            if (!feature) {
                feature = this.findLibraryElement(
                    node,
                    fallback,
                    document,
                    isFeature,
                    "Could not find implicit redefinition"
                );
            }
            if (feature) {
                current.$meta.addSpecialization(
                    feature.$meta,
                    SpecializationKind.Redefinition,
                    "implicit"
                );
            }
        };

        redefine("trigger", "Actions::TransitionAction::accepter");
        // TODO: redefine guard once/if inline expressions generalize expressions (and feature indirectly)
        // redefine("guard", "TransitionPerformances::TransitionPerformance::guard");
        redefine("effect", "Actions::TransitionAction::effect");
    }

    /**
     * Setup explicit comment references
     */
    @builder(Comment)
    linkComment(node: Comment, document: LangiumDocument): void {
        const linker = this.linker(document.uri);
        node.about.forEach((ref) => {
            const element = linker.linkReference(ref, document);
            if (element) {
                node.$meta.annotates.push(element);
                element.comments.push({ element: node.$meta });
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
            const element = linker.linkReference(ref, document);
            if (element) {
                node.$meta.annotates.push(element);
                element.metadata.push({ element: node.$meta });
            }
        });
    }

    /**
     * Setup implicit feature typings from assigned values
     */
    @builder(Feature)
    addFeatureValueTypings(node: Feature, document: LangiumDocument): void {
        if (
            !node.value ||
            node.$meta.direction !== "none" ||
            node.$meta.specializations().some((s) => s.source === "explicit")
        )
            return;

        this.buildNode(node.value.expression, document);
        const type = this.findType(node, node.value.expression.$meta.returnType(), document);
        if (!type) return;
        node.$meta.addSpecialization(type, SpecializationKind.Subsetting, "implicit");

        // TODO: feature write performance / binding connector as in spec
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
            const type = t.self();
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
                `Could not find implicit specialization for ${getSpecializationKindString(kind)}`
            );
            if (implicit && implicit !== node) {
                node.$meta.addSpecialization(implicit.$meta, kind, "implicit");
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
    protected redefineFirstIf<
        T extends Type,
        K extends RecordKey = KeysMatching<T["$meta"], Array<Related<FeatureMeta>>>
    >({
        node,
        key,
        predicate,
        document,
    }: {
        node: T;
        key: K;
        predicate: (f: Related<FeatureMeta>) => boolean;
        document: LangiumDocument;
    }): void {
        const meta = node.$meta as Record<K, Array<Related<FeatureMeta>>>;
        const index = meta[key].findIndex(predicate);
        if (index < 0) return;
        const feature = meta[key].at(index) as Related<FeatureMeta>;
        // make sure the feature is pre-linked before attempting to add an
        // implicit redefinition
        const ast = feature.element.self();
        if (ast) this.preLinkNode(ast, document);
        for (const specialization of node.$meta.allTypes()) {
            for (const baseFeature of specialization.features) {
                if (predicate(baseFeature)) {
                    feature.element.addSpecialization(
                        baseFeature.element,
                        SpecializationKind.Redefinition,
                        "implicit"
                    );
                    return;
                }
            }
        }
    }
}

const EMPTY_RANGE: Range = {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
};
