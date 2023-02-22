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
    isAssociation,
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
    isUsage,
    isRequirementUsage,
    SysMlAstType,
    CaseDefinition,
    CaseUsage,
    RequirementUsage,
    RequirementDefinition,
    ActionUsage,
    ActionDefinition,
    isActionDefinition,
    isActionUsage,
    StateUsage,
    StateDefinition,
    TransitionUsage,
    isTransitionUsage,
    Metaclass,
    MetadataFeature,
    Comment,
    isMetaclass,
    isMetadataFeature,
    isElementReference,
    Relationship,
} from "../../../generated/ast";
import {
    callAll,
    ElementID,
    Metamodel,
    META_FACTORY,
    ModelLevelExpressionEvaluator,
} from "../../../model";
import { followAlias } from "../../../model/util";
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
const MetaclassOverrides: { readonly [K in keyof SysMlAstType]?: string } = {
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
    [K in keyof SysMlAstType]?: PreLinkFunction<SysMlAstType[K]>[];
};

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
    protected readonly metaFactories: Map<string, (node: AstNode, id: ElementID) => Metamodel>;
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
        this.metaFactories = typeIndex.expandToDerivedTypes(META_FACTORY);

        // using arrays of functions for easier composition, in SysML there are
        // a lot of types that specialize multiple supertypes and declaring
        // functions for each of them separately is tedious, arrays will
        // automatically include all base classes setup functions
        this.preLinkFunctions = this.registerLinkFunctions({
            Element: [this.assignMetaclass],
            Type: [this.addSemanticMetadata, this.linkTypeRelationships],
            Classifier: [this.addClassifierImplicits],
            Feature: [
                this.linkFeatureRelationships,
                this.addFeatureImplicits,
                this.addFeatureValueTypings,
            ],
            Association: [this.redefineEnds],
            Connector: [this.redefineEnds],
            Namespace: [this.resolveNamespaceImports],
            Definition: [this.addDefinitionImplicits],
            Usage: [this.addUsageImplicits],
            CaseDefinition: [this.redefineObjective, this.redefineSubject],
            CaseUsage: [this.redefineObjective, this.redefineSubject],
            RequirementDefinition: [this.redefineSubject],
            RequirementUsage: [this.redefineSubject],
            ActionUsage: [this.redefineActionParameters],
            ActionDefinition: [this.redefineActionParameters],
            StateDefinition: [this.redefineStateSubactions],
            StateUsage: [this.redefineStateSubactions],
            TransitionUsage: [this.redefineTransitionUsageFeatures],
            MetadataFeature: [this.linkMetadata],
            Comment: [this.linkComment],
        });
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

        // only called with resolved references
        const target = ref.$meta.to.target as Element;
        this.preLinkNode(target, getDocument(target));
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
        children.forEach(this.initializeMetamodel, this);
    }

    onChanged(document: LangiumDocument<AstNode>): void {
        const added: AstNode[] = [];
        for (const child of this.indexManager.stream(document, true)) {
            const meta = child.$meta;
            if (meta) meta.reset();
            else {
                this.addMeta(child, document);
                added.push(child);
            }
        }
        added.forEach(this.initializeMetamodel, this);
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
     * Initialize metamodel, must only be called once and after every node in
     * the document has been constructed and assigned
     * @param node AST node to initialize metamodel for
     * @returns
     */
    protected initializeMetamodel(node: AstNode): void {
        if (!node.$meta) return;
        callAll(node.$meta, "initialize", node);
    }

    /**
     * Construct appropriate metamodel for {@link node}
     * @param node AST node to construct metamodel for
     * @returns Constructed metamodel
     */
    protected constructMetamodel(node: AstNode): Metamodel {
        const factory = this.metaFactories.get(node.$type);
        if (!factory) throw new Error(`Invalid type for metamodel: ${node.$type}`);
        return factory(node, this.idProvider.next());
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
            console.log("  ".repeat(this.statistics.currentDepth), "> ", node.$meta.qualifiedName);
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
            console.log("  ".repeat(this.statistics.currentDepth), "< ", node.$meta.qualifiedName);
        }
    }

    /**
     * Assign a standard library metaclass based on the AST type
     */
    protected assignMetaclass(node: Element, document: LangiumDocument): void {
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
            get: (): MetadataFeature | undefined => {
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

                let feature: MetadataFeature | undefined;
                if (!metaclass) {
                    builder.addError(document, node, `Could not find metaclass for ${name}`);
                } else {
                    // make sure the library metaclass is constructed so that it
                    // can be used in evaluations, important for
                    // SemanticMetadata
                    this.preLinkNode(metaclass);

                    // not assigning to any specific parent property
                    feature = builder.construct("MetadataFeature", { $container: node }, document);
                    feature.$meta.addSpecialization(metaclass, SpecializationKind.Typing, false);
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
        T extends AstParent<SysMlAstType[V]>,
        P extends AstPropertiesFor<SysMlAstType[V], T>
    >(
        type: V,
        properties: ConstructParams<SysMlAstType[V], T, P>,
        document: LangiumDocument
    ): SysMlAstType[V] {
        const node = this.astReflection.createNode(type, properties);
        this.addMeta(node, document);
        // valid document implies that parsed nodes have had $meta assigned so
        // initialize is safe to call
        this.initializeMetamodel(node);
        return node;
    }

    /**
     * Resolve imports of {@link node} and its parents since they are implicitly
     * imported
     */
    protected resolveNamespaceImports(node: Namespace, document: LangiumDocument): void {
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
            const impMeta = imp.$meta;

            // if importing by name only dependant scopes don't have to be
            // linked
            if (impMeta.kind === "specific") continue;

            const description = impMeta.importDescription.target;
            if (!description) continue; // failed to link

            const target = description.node;
            if (!target) continue; // nothing to resolve

            // link dependant namespaces recursively
            this.preLinkNode(target, getDocument(target));
        }
    }

    /**
     * Setup explicit feature relationships
     */
    protected linkFeatureRelationships(node: Feature, document: LangiumDocument): void {
        const linker = this.linker(document.uri);
        node.chains.forEach((ref) => {
            const element = linker.linkReference(ref, document);
            if (!element) return;
            const first = ref.chain[ref.$meta.featureIndices[0]].ref;
            if (first) {
                // first feature in the chain is the featuring type of the
                // owning feature
                const firstFeature = followAlias(first) as Feature | undefined;
                if (firstFeature) {
                    for (const featuringRef of firstFeature.featuredBy) {
                        const featuring = featuringRef.$meta.to.target;
                        if (!featuring) continue;
                        node.$meta.featuredBy.add(featuring);
                        element.$meta.addChild(node);
                    }
                }
            }

            const last = followAlias(element) as Feature | undefined;
            if (!last) return;
            // last feature in the chain is the featured type of the owning
            // feature
            last.$meta.featuredBy.add(node);
            node.$meta.addChild(last);
        });

        node.featuredBy.forEach((ref) => {
            const element = linker.linkReference(ref, document);
            if (!element) return;
            node.$meta.featuredBy.add(element as Type);
            (element as Type).$meta.addChild(node);
        });

        node.$meta.allTypes().forEach((t) => (node.$meta.classifier |= t.$meta.classifier));
    }

    /**
     * Setup explicit type relationships
     */
    protected linkTypeRelationships(node: Type, document: LangiumDocument): void {
        // explicit
        const linker = this.linker(document.uri);
        getExplicitSpecializations(node).forEach((ref) => {
            const element = linker.linkReference(ref, document);
            if (element)
                node.$meta.addSpecialization(element as Type, getSpecializationKind(ref), false);
        });
    }

    /**
     * Setup implicit classifier relationships
     */
    protected addClassifierImplicits(node: Classifier, document: LangiumDocument): void {
        // implicit
        if (node.specializes.length !== 0) return;
        this.addImplicits(node, document, isType);
    }

    /**
     * Setup implicit feature relationships
     */
    protected addFeatureImplicits(node: Feature, document: LangiumDocument): void {
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
                node.$meta.featuredBy.add(anything);
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
    protected redefineEnds(node: Association | Connector): void {
        const baseEndIterator = node.$meta
            .basePositionalFeatures((f) => f.$meta.isEnd, isAssociation)
            .iterator();

        stream(node.$meta.features)
            .filter((f) => f.$meta.isEnd)
            .forEach((end) => {
                if (end.redefines.length > 0) return; // no implicit end redefinition
                const base = baseEndIterator.next();
                if (base.done) return;

                // not prelinking the child elements to hide implicit
                // redefinitions
                end.$meta.addSpecialization(base.value, SpecializationKind.Redefinition, true);
                return;
            });
    }

    /**
     * Setup implicit definition relationships
     */
    protected addDefinitionImplicits(node: Definition, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const base = this.findLibraryElement(
            node,
            implicitIndex.get(node.$type as SysMLType, node.$meta.defaultSupertype()),
            document,
            isClassifier,
            `Could not find implicit definition specialization for ${node.$type}`
        );

        if (base && node !== base && !node.$meta.allTypes().includes(base)) {
            node.$meta.addSpecialization(base, SpecializationKind.Typing, true);
        }
    }

    /**
     * Setup implicit usage relationships
     */
    protected addUsageImplicits(node: Usage, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const base = this.findLibraryElement(
            node,
            implicitIndex.get(node.$type as SysMLType, node.$meta.defaultSupertype()),
            document,
            isFeature,
            `Could not find implicit usage specialization for ${node.$type}`
        );

        if (base && node !== base && !node.$meta.allTypes().includes(base)) {
            node.$meta.addSpecialization(base, SpecializationKind.Subsetting, true);
        }
    }

    /**
     * Setup implicit action parameter redefinitions
     */
    protected redefineActionParameters(
        action: ActionUsage | ActionDefinition,
        document: LangiumDocument
    ): void {
        const isAction = (node: unknown): node is ActionUsage | ActionDefinition =>
            isActionDefinition(node) || isActionUsage(node);
        const baseActions = action.$meta.specializationsMatching(isAction).toArray();

        if (baseActions.length === 0) return; // no action typings

        const isParameter = (f: Feature): boolean => f.$meta.direction !== "none";
        const ownedParameters = action.$meta.features.filter(isParameter);
        const baseParameterIterators = baseActions.map((action) =>
            stream(action.type.$meta.features).filter(isParameter).iterator()
        );

        for (const parameter of ownedParameters) {
            this.preLinkNode(parameter, document);
            const explicit = parameter.redefines.length > 0;

            // can't continue if redefines explicitly, have to advance iterators
            for (const baseIter of baseParameterIterators) {
                const baseParameter = baseIter.next();

                // don't add implicit redefinition if there is an explicit one
                // already
                if (baseParameter.done || explicit) continue;

                parameter.$meta.addSpecialization(
                    baseParameter.value,
                    SpecializationKind.Redefinition,
                    true
                );
            }
        }
    }

    /**
     * Setup implicit subject parameter redefinition
     */
    protected redefineSubject(
        node: CaseUsage | CaseDefinition | RequirementDefinition | RequirementUsage,
        document: LangiumDocument
    ): void {
        const isSubject = (f: Feature): boolean => isUsage(f) && f.$meta.isSubjectParameter;
        this.redefineFirstIf(node, "features", isSubject, document);
    }

    /**
     * Setup implicit objective parameter redefinition
     */
    protected redefineObjective(node: CaseUsage | CaseDefinition, document: LangiumDocument): void {
        const isObjective = (f: Feature): boolean =>
            isRequirementUsage(f) && f.$meta.requirementKind === "objective";
        this.redefineFirstIf(node, "features", isObjective, document);
    }

    /**
     * Setup implicit state subactions redefinitions
     */
    protected redefineStateSubactions(
        node: StateUsage | StateDefinition,
        document: LangiumDocument
    ): void {
        const redefine = (kind: StateSubactionKind): void => {
            const matches = (f: Feature): boolean =>
                isActionUsage(f) && f.$meta.stateSubactionKind === kind;
            this.redefineFirstIf(node, "subactions", matches, document);
        };

        redefine("do");
        redefine("entry");
        redefine("exit");
    }

    /**
     * Setup implicit transition usage feature redefinitions
     */
    protected redefineTransitionUsageFeatures(
        node: TransitionUsage,
        document: LangiumDocument
    ): void {
        type K = KeysMatching<TransitionUsage, Feature | undefined>;
        const findBase = (node: TransitionUsage, k: K): Feature | undefined => {
            for (const specialization of node.$meta.typesMatching(isTransitionUsage)) {
                if (specialization[k]) return specialization[k];
            }

            for (const specialization of node.$meta.typesMatching(isTransitionUsage)) {
                const feature = findBase(specialization, k);
                if (feature) return feature;
            }

            return;
        };

        const redefine = (k: K, fallback: string): void => {
            const current = node[k];
            if (!current) return;
            let feature = findBase(node, k);
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
                current.$meta.addSpecialization(feature, SpecializationKind.Redefinition, true);
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
    protected linkComment(node: Comment, document: LangiumDocument): void {
        const linker = this.linker(document.uri);
        node.about.forEach((ref) => {
            const element = linker.linkReference(ref, document);
            if (element) {
                node.$meta.annotates.push(element);
                element.$meta.comments.push(node);
            }
        });
    }

    /**
     * Setup explicit metadata references
     */
    protected linkMetadata(node: MetadataFeature, document: LangiumDocument): void {
        const linker = this.linker(document.uri);
        node.about.forEach((ref) => {
            const element = linker.linkReference(ref, document);
            if (element) {
                node.$meta.annotates.push(element);
                element.$meta.metadata.push(node);
            }
        });
    }

    /**
     * Setup implicit specializations from Metaobjects::SemanticMetadata
     */
    protected addSemanticMetadata(node: Type, document: LangiumDocument): void {
        for (const metadata of node.$meta.metadata) {
            this.buildNode(metadata, document);
            const baseTypes = metadata.$meta
                .allFeatures()
                .filter((f) => f.$meta.is("Metaobjects::SemanticMetadata::baseType"));

            for (const baseType of baseTypes) {
                const value = baseType.value;
                if (!value) continue;

                this.buildNode(value.expression, document);
                const result = this.evaluator.evaluate(value.expression, baseType)?.at(0);
                if (!result || !isMetadataFeature(result)) continue;

                for (const annotated of result.$meta.annotates) {
                    if (!isType(annotated)) continue;
                    node.$meta.addSpecialization(annotated, node.$meta.specializationKind(), true);
                }
            }
        }
    }

    /**
     * Setup implicit feature typings from assigned values
     */
    protected addFeatureValueTypings(node: Feature, document: LangiumDocument): void {
        if (
            !node.value ||
            node.$meta.direction !== "none" ||
            node.$meta.specializations().some((s) => !s.isImplicit)
        )
            return;

        this.buildNode(node.value.expression, document);
        const type = this.findType(node, node.value.expression.$meta.returnType(), document);
        if (!type) return;
        node.$meta.addSpecialization(type, SpecializationKind.Subsetting, true);

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
            if (t !== node) this.buildNode(t, getDocument(t), false);
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
        type: string | Type | undefined,
        document: LangiumDocument
    ): Type | undefined {
        if (!type) return;
        if (typeof type !== "string") return type;
        return this.findLibraryElement(node, type, document, isType, "Could not find library type");
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
                node.$meta.addSpecialization(implicit, kind, true);
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
        K extends RecordKey = KeysMatching<T["$meta"], Array<Feature>>
    >(node: T, key: K, predicate: (f: Feature) => boolean, document: LangiumDocument): void {
        const meta = node.$meta as Record<K, Array<Feature>>;
        const index = meta[key].findIndex(predicate);
        if (index < 0) return;
        const feature = meta[key].at(index) as Feature;
        // make sure the feature is pre-linked before attempting to add an
        // implicit redefinition
        this.preLinkNode(feature, document);
        for (const specialization of node.$meta.allTypes()) {
            for (const baseFeature of specialization.$meta.features) {
                if (predicate(baseFeature)) {
                    feature.$meta.addSpecialization(
                        baseFeature,
                        SpecializationKind.Redefinition,
                        true
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
