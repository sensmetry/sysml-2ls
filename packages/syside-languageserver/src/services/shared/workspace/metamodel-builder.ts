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
    interruptAndCheck,
    LangiumDocument,
    ReferenceInfo,
    ServiceRegistry,
    stream,
} from "langium";
import { CancellationToken } from "vscode-languageserver";
import {
    ElementReference,
    Feature,
    Type,
    Association,
    Connector,
    Namespace,
    Element,
    Usage,
    Definition,
    Classifier,
    RequirementUsage,
    ActionUsage,
    ActionDefinition,
    TransitionUsage,
    Metaclass,
    MetadataFeature,
    Comment,
    isElementReference,
    MembershipImport,
    Specialization,
    Subsetting,
    Conjugation,
    Redefinition,
    FeatureTyping,
    Expression,
    SubjectMembership,
    ObjectiveMembership,
    StateSubactionMembership,
    InvocationExpression,
    OperatorExpression,
    FeatureReferenceExpression,
    Relationship,
    ReferenceUsage,
    EndFeatureMembership,
    Membership,
    MultiplicityRange,
    LiteralInfinity,
    OccurrenceUsage,
    OccurrenceDefinition,
    ItemFlowEnd,
    OwningMembership,
    FeatureMembership,
    VariantMembership,
    SuccessionAsUsage,
    ReferenceSubsetting,
    Dependency,
    Inheritance,
    FeatureRelationship,
    TypeFeaturing,
    ItemFlow,
    FlowConnectionUsage,
} from "../../../generated/ast";
import {
    BasicMetamodel,
    FeatureMeta,
    isMetamodel,
    MetaCtor,
    META_FACTORY,
    TransitionUsageMeta,
    TypeMeta,
    MetadataFeatureMeta,
    FeatureTypingMeta,
    MembershipMeta,
    ElementMeta,
    Bounds,
    SubsettingMeta,
    RedefinitionMeta,
    ExpressionMeta,
    UsageMeta,
    ReferenceSubsettingMeta,
    sanitizeName,
    AnnotationMeta,
    TypeFeaturingMeta,
    NamespaceMeta,
    InheritanceMeta,
    ClassifierMeta,
    MetaclassMeta,
    ConnectorMeta,
    AssociationMeta,
    DefinitionMeta,
    ActionDefinitionMeta,
    ActionUsageMeta,
    ReferenceUsageMeta,
    RequirementUsageMeta,
    CommentMeta,
    FeatureReferenceExpressionMeta,
    InvocationExpressionMeta,
    OperatorExpressionMeta,
    RelationshipMeta,
    MultiplicityRangeMeta,
    OccurrenceUsageMeta,
    VariantMembershipMeta,
    ItemFlowEndMeta,
    SuccessionAsUsageMeta,
    DependencyMeta,
    MembershipImportMeta,
    RelationshipOptions,
    GeneralType,
    ItemFlowMeta,
    EndFeatureMembershipMeta,
    FlowConnectionUsageMeta,
} from "../../../model";
import { SysMLDefaultServices, SysMLSharedServices } from "../../services";
import { SysMLIndexManager } from "./index-manager";
import { TypeMap, typeIndex } from "../../../model/types";
import { implicitIndex } from "../../../model/implicits";
import { FeatureDirectionKind, TransitionFeatureKind } from "../../../model/enums";
import { NonNullReference, SysMLLinker } from "../../references/linker";
import { Statistics } from "../../../utils/common";
import {
    SubtypeKeys,
    SysMLAstReflection,
    SysMLInterface,
    SysMLType,
    SysMLTypeList,
} from "../../sysml-ast-reflection";
import { SysMLConfigurationProvider } from "./configuration-provider";
import { URI } from "vscode-uri";
import { ModelUtil } from "../model-utils";
import { isExpressionError, SysMLExpressionEvaluator } from "../evaluator";
import { astToModel, clearArtifacts } from "../../../utils/ast-to-model";
import { TypedModelDiagnostic } from "../../validation";
import { streamModel } from "../../../utils";

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
     * Build a single element according to the specification
     * @param element
     * @param document
     */
    buildElement(element: ElementMeta, document: LangiumDocument): void;

    /**
     * Build a model tree according to the specification
     * @param root
     * @param document
     * @see {@link buildElement}
     */
    buildModel(root: ElementMeta, document: LangiumDocument): void;
}

// All linking of scope importing references (imports, specializations) has to
// be done recursively unless synchronizing on additional document build stages

type PreLinkFunction<T = BasicMetamodel> = [number, (node: T, document: LangiumDocument) => void];
type PreLinkFunctionMap = {
    [K in SysMLType]?: PreLinkFunction<SysMLTypeList[K]["$meta"]>[];
};

const Builders: PreLinkFunctionMap = {};

function builder<K extends SysMLType>(type: K | K[], order = 0) {
    return function (
        _: object,
        __: string,
        descriptor: TypedPropertyDescriptor<PreLinkFunction<SysMLTypeList[K]["$meta"]>[1]>
    ): void {
        const value = descriptor.value;
        if (!value) return;

        if (typeof type === "string") type = [type];
        type.forEach((t) => {
            (Builders[t] ??= [] as NonNullable<(typeof Builders)[K]>).push([order, value]);
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
    protected readonly util: ModelUtil;
    protected readonly indexManager: SysMLIndexManager;
    protected readonly registry: ServiceRegistry;
    protected readonly config: SysMLConfigurationProvider;
    protected readonly astReflection: SysMLAstReflection;
    protected readonly statistics: Statistics;
    protected readonly evaluator: SysMLExpressionEvaluator;

    protected readonly metaFactories: Partial<Record<string, MetaCtor<AstNode>>>;
    protected readonly preLinkFunctions: Map<string, Set<PreLinkFunction[1]>>;

    constructor(services: SysMLSharedServices) {
        this.indexManager = services.workspace.IndexManager;
        this.registry = services.ServiceRegistry;
        this.config = services.workspace.ConfigurationProvider;
        this.astReflection = services.AstReflection;
        this.evaluator = services.Evaluator;
        this.statistics = services.statistics;
        this.util = services.Util;

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

    buildElement(element: ElementMeta, document: LangiumDocument<AstNode>): void {
        this.preLinkModel(element, document);
    }

    buildModel(root: ElementMeta, document: LangiumDocument<AstNode>): void {
        for (const element of streamModel(root)) {
            this.preLinkModel(element, document);
        }
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
        } else if (owner.is(Membership)) {
            // a new member was resolved, make sure the member caches are up to
            // date, this is needed for succession as usage resolution, i.e.
            // when the previous element is `first start`
            owner.owner()?.invalidateMemberCaches();
            // importing name only, same as named import
            return;
        }

        const target = ref.$meta.to.target;
        if (target) this.preLinkModel(target);
    }

    onParsed(document: LangiumDocument<AstNode>): void {
        // reset the cached nodes in case they are stale
        const children = document.astNodes;
        for (const child of children) {
            this.addMeta(child, document);
        }

        // second initialization pass
        children.forEach((child) => astToModel(child.$meta as BasicMetamodel, child));
    }

    onChanged(document: LangiumDocument<AstNode>): void {
        const added: AstNode[] = [];
        for (const child of document.astNodes) {
            const meta = child.$meta;
            if (meta) clearArtifacts(meta);
            else {
                this.addMeta(child, document);
                added.push(child);
            }
        }
        added.forEach((child) => astToModel(child.$meta as BasicMetamodel, child));
    }

    /**
     * Add `$meta` member to {@link child}
     * @param child node to add metamodel member to
     * @param document document containing {@link child}
     */
    protected addMeta(child: AstNode, document: LangiumDocument): void {
        const meta = this.constructMetamodelAst(child, document);
        child.$meta = meta;
        if (isElementReference(child)) child.$meta.document = document;
    }

    /**
     * Construct appropriate metamodel for {@link node}
     * @param node AST node to construct metamodel for
     * @returns Constructed metamodel
     */
    protected constructMetamodelAst(node: AstNode, document: LangiumDocument): BasicMetamodel {
        return this.constructMetamodel(node.$type as SysMLType, document);
    }

    constructMetamodel<K extends SysMLType>(
        type: K,
        document: LangiumDocument
    ): SysMLTypeList[K]["$meta"] {
        const factory = this.metaFactories[type];
        if (!factory) throw new Error(`Invalid type for metamodel: ${type}`);
        return factory(this.util.idProvider, document) as SysMLTypeList[K]["$meta"];
    }

    async preLink(
        node: AstNode | undefined,
        document: LangiumDocument<AstNode>,
        cancelToken: CancellationToken
    ): Promise<void> {
        if (node) {
            return this.preLinkNode(node, document);
        }

        const meta = document.parseResult.value.$meta;
        if (meta?.is(Element)) {
            for (const element of streamModel(meta)) {
                await interruptAndCheck(cancelToken);
                this.preLinkModel(element, document);
            }
        }

        for (const node of document.astNodes) {
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
        if (meta) this.preLinkModel(meta, document);
    }

    protected preLinkModel(meta: BasicMetamodel, document?: LangiumDocument): void {
        if (meta.setupState !== "none") return; // already setting up, avoid infinite recursion
        document ??= meta.document;

        const debug = this.config.get().debug.linkingTrace && meta.is(Element);
        if (debug) {
            console.log(
                "  ".repeat(this.statistics.currentDepth),
                `> ${meta.qualifiedName} [${meta.nodeType()}]`
            );
        }

        const preprocess = this.preLinkFunctions.get(meta.nodeType());
        meta.setupState = "active";
        if (preprocess) {
            for (const fn of preprocess) {
                this.statistics.enter(fn.name);

                if (debug) console.log("  ".repeat(this.statistics.currentDepth), fn.name);
                fn.call(this, meta, document);

                this.statistics.exit(fn.name);
            }
        }
        meta.setupState = "completed";

        if (debug) {
            console.log(
                "  ".repeat(this.statistics.currentDepth),
                `< ${meta.qualifiedName} [${meta.nodeType()}]`
            );
        }
    }

    /**
     * Assign a standard library metaclass based on the AST type
     */
    @builder(Element)
    protected assignMetaclass(node: ElementMeta, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const cache = {
            node,
            document,
            builder: this,
        };

        // Since most elements will never have their metaclasses accessed, use a
        // lazily evaluated property. This way this build step is basically free
        node.setMetaclass((): MetadataFeatureMeta | undefined => {
            const { node, document, builder } = cache;
            const name = MetaclassOverrides[node.nodeType()] ?? node.nodeType();
            let metaclass: MetaclassMeta | undefined | null;
            for (const pack of MetaclassPackages) {
                const meta = builder.indexManager.findGlobalElement(pack + name, document, true);
                if (meta?.is(Metaclass)) {
                    metaclass = meta;
                    break;
                }
            }

            let feature: MetadataFeatureMeta | undefined;
            if (!metaclass) {
                document.modelDiagnostics.add(node, {
                    element: node,
                    message: `Could not find metaclass for ${name}`,
                    severity: "error",
                    info: {},
                });
            } else {
                // make sure the library metaclass is constructed so that it
                // can be used in evaluations, important for
                // SemanticMetadata
                this.preLinkModel(metaclass);

                // not assigning to any specific parent property, ignore TS
                // complaining about invalid parent type, it's not going to be
                // used anyway

                feature = MetadataFeatureMeta.create(this.util.idProvider, document);
                feature.addAnnotation([
                    AnnotationMeta.create(this.util.idProvider, document, {
                        isImplied: true,
                    }),
                    node,
                ]);
                feature.addHeritage([
                    FeatureTypingMeta.create(this.util.idProvider, document),
                    metaclass,
                ]);
            }

            return feature;
        });
    }

    /**
     * Resolve imports of {@link node} and its parents since they are implicitly
     * imported
     */
    @builder(Namespace)
    protected resolveNamespaceImports(node: NamespaceMeta, document: LangiumDocument): void {
        // again check for circular dependencies TODO: surface circular
        // dependencies as warnings?
        if (node.importResolutionState !== "none") return;

        node.importResolutionState = "active";

        // make sure parent namespace imports are resolved fully
        let parent: ElementMeta | undefined = node.parent();
        while (parent) {
            this.preLinkModel(parent, document);
            parent = parent.parent();
        }

        this.linker(document.uri).resolveImports(node, document);
        node.importResolutionState = "completed";

        for (const imp of node.imports) {
            // if importing by name only dependant scopes don't have to be
            // linked
            if (imp.is(MembershipImport) && !imp.isRecursive) continue;

            const description = imp.element();
            if (!description) continue; // failed to link

            // link dependant namespaces recursively
            this.preLinkModel(description);
        }
    }

    @builder(Namespace, 10000)
    protected linkNamespaceFeatures(node: NamespaceMeta, document: LangiumDocument): void {
        // feature elements need to be linked early to resolve implicit naming
        // that may be used to reference them later on
        node.featureMembers().forEach((member) => {
            const element = member.element();
            if (
                element &&
                element.is(Feature) &&
                !(element.declaredName || element.declaredName) &&
                // only features with specializations will have naming features
                element.specializations().length > 0
            )
                this.preLinkModel(element, document);
        });
    }

    /**
     * Setup explicit feature relationships
     */
    @builder(Feature)
    protected collectFeatureClassifiers(node: FeatureMeta, _document: LangiumDocument): void {
        node.allTypes().forEach((t) => (node["_classifier"] |= t.classifier));
    }

    /**
     * Setup implicit specializations from Metaobjects::SemanticMetadata
     */
    @builder(Type)
    protected addSemanticMetadata(node: TypeMeta, document: LangiumDocument): void {
        for (const metadata of node.metadata) {
            this.buildTree(metadata, document);
            const baseTypes = metadata
                .allFeatures()
                .filter((f) => f.element()?.conforms("Metaobjects::SemanticMetadata::baseType"));

            for (const member of baseTypes) {
                const baseType = member.element();
                if (!baseType) continue;
                const value = baseType.value?.element();
                if (!value) continue;

                this.buildTree(value, document);
                const result = this.evaluator.evaluate(value, baseType);
                if (isExpressionError(result)) {
                    document.modelDiagnostics.add(value, <TypedModelDiagnostic<ExpressionMeta>>{
                        element: value,
                        message: result.message,
                        severity: "warning",
                        info: {},
                    });
                    continue;
                }

                const meta = result.at(0);
                if (!meta || !isMetamodel(meta) || !meta.is(MetadataFeature)) continue;

                for (const annotated of meta.annotatedElements()) {
                    if (!annotated.is(Type)) continue;
                    const specialization = this.constructMetamodel(
                        node.specializationKind(),
                        document
                    ) as InheritanceMeta;
                    // can't get the factory options generically so will set
                    // up properties manually
                    specialization["_isImplied"] = true;
                    node.addHeritage([specialization, annotated]);
                }
            }
        }
    }

    protected linkTypeRelationship(
        node: FeatureRelationship["$meta"] | InheritanceMeta,
        document: LangiumDocument
    ): TypeMeta | undefined {
        const source = node.source();

        // link only owned elements, otherwise they should be linked on their
        // own
        const target = node.element();
        if (target && target.parent() === node) {
            this.preLinkModel(target, document);
        }

        if (source && source !== node.parent()) {
            this.preLinkModel(source, document);
            if (source.is(Feature)) return source.basicFeature();
        }

        if (!source?.is(Type)) return;
        return source;
    }

    @builder([Specialization, Conjugation], 100)
    protected setupSpecialization(node: InheritanceMeta, document: LangiumDocument): void {
        const source = this.linkTypeRelationship(node, document);
        const target = node.finalElement();
        if (target) source?.["onHeritageAdded"](node, target);
    }

    @builder(FeatureRelationship, 100)
    protected setupTypeRelationship(
        node: FeatureRelationship["$meta"],
        document: LangiumDocument
    ): void {
        this.linkTypeRelationship(node, document);
    }

    /**
     * Setup explicit type relationships
     */
    @builder(Type)
    protected linkTypeRelationships(node: TypeMeta, document: LangiumDocument): void {
        // explicit
        node.heritage.forEach((r) => this.preLinkModel(r, document));
        node.typeRelationships.forEach((r) => this.preLinkModel(r, document));
    }

    /**
     * Setup implicit classifier relationships
     */
    @builder(Classifier, 10)
    protected addClassifierImplicits(node: ClassifierMeta, document: LangiumDocument): void {
        // seems the written spec is wrong and implicit supertypes are always added
        // if (node.$meta.specializations().some((r) => r.is(Specialization) && !r.isImplied)) return;
        this.addImplicits(node, document, Type);
    }

    /**
     * Setup implicit feature relationships
     */
    @builder(Feature, 10)
    protected addFeatureImplicits(node: FeatureMeta, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;
        this.addImplicits(node, document, Feature);
    }

    /**
     * Setup implicit Association and Connector end feature redefinitions
     * @param node
     */
    @builder([Association, Connector], 1000)
    protected redefineEnds(node: AssociationMeta | ConnectorMeta, document: LangiumDocument): void {
        const baseEndIterator = node
            .basePositionalFeatures(
                (f) => f.is(EndFeatureMembership) || !!f.element()?.isEnd,
                (t) => t.is(Association)
            )
            .iterator();

        stream(node.ownedEnds()).forEach((end) => {
            const base = baseEndIterator.next();
            if (base.done) return;
            if (end.specializations(Redefinition).length > 0) return; // no implicit end redefinition
            const target = base.value.element();
            if (!target) return;

            // not prelinking the child elements to hide implicit
            // redefinitions
            const specialization = RedefinitionMeta.create(this.util.idProvider, document, {
                isImplied: true,
            });
            end.addHeritage([specialization, target]);
            return;
        });
    }

    /**
     * Setup implicit definition relationships
     */
    @builder(Definition, 15)
    protected addDefinitionImplicits(node: DefinitionMeta, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const base = this.findLibraryElement(
            node,
            implicitIndex.get(node.nodeType(), node.defaultSupertype()),
            document,
            Classifier,
            `Could not find implicit definition specialization for ${node.nodeType()}`
        );

        if (base && node !== base && !node.allTypes().includes(base)) {
            const specialization = FeatureTypingMeta.create(this.util.idProvider, document, {
                isImplied: true,
            });
            node.addHeritage([specialization, base]);
        }
    }

    /**
     * Setup implicit usage relationships
     */
    @builder(Usage, 15)
    protected addUsageImplicits(node: UsageMeta, document: LangiumDocument): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const base = this.findLibraryElement(
            node,
            implicitIndex.get(node.nodeType(), node.defaultSupertype()),
            document,
            Feature,
            `Could not find implicit usage specialization for ${node.nodeType()}`
        );

        if (base && node !== base && !node.allTypes().includes(base)) {
            const specialization = SubsettingMeta.create(this.util.idProvider, document, {
                isImplied: true,
            });
            node.addHeritage([specialization, base]);
        }
    }

    /**
     * Setup implicit action parameter redefinitions
     */
    @builder([ActionUsage, ActionDefinition], 1000)
    protected redefineActionParameters(
        action: ActionUsageMeta | ActionDefinitionMeta,
        document: LangiumDocument
    ): void {
        const baseActions = action
            .specializationsMatching([ActionUsage, ActionDefinition])
            .toArray();

        if (baseActions.length === 0) return; // no action typings

        const ownedParameters = stream(action.featureMembers())
            .map((member) => member.element())
            .nonNullable()
            .filter((f) => f.isParameter)
            .filter((f) => !f.isIgnoredParameter());
        const baseParameterIterators = baseActions.map((action) =>
            stream(action.element()?.featureMembers() ?? [])
                .map((member) => member.element())
                .nonNullable()
                .filter((f) => f.isParameter)
                .filter((f) => !f.isIgnoredParameter())
                .iterator()
        );

        for (const parameter of ownedParameters) {
            this.preLinkModel(parameter, document);
            const explicit = parameter.specializations(Redefinition).length > 0;

            // can't continue if redefines explicitly, have to advance iterators
            for (const baseIter of baseParameterIterators) {
                const baseParameter = baseIter.next();

                // don't add implicit redefinition if there is an explicit one
                // already
                if (baseParameter.done || explicit) continue;

                const specialization = RedefinitionMeta.create(this.util.idProvider, document, {
                    isImplied: true,
                });
                parameter.addHeritage([specialization, baseParameter.value]);
            }
        }
    }

    /**
     * Setup implicit subject parameter redefinition
     */
    @builder(ReferenceUsage, 1000)
    protected redefineSubject(node: ReferenceUsageMeta, _document: LangiumDocument): void {
        if (!node.parent()?.is(SubjectMembership)) return;
        this.redefineFirstIf(node, (member) => {
            return member.is(SubjectMembership) && !!member.element()?.is(Usage);
        });
    }

    /**
     * Setup implicit objective parameter redefinition
     */
    @builder(RequirementUsage)
    protected redefineObjective(node: RequirementUsageMeta, _document: LangiumDocument): void {
        if (!node.parent()?.is(ObjectiveMembership)) return;
        this.redefineFirstIf(node, (member) => {
            return member.is(ObjectiveMembership) && !!member.element()?.is(RequirementUsage);
        });
    }

    /**
     * Setup implicit state subactions redefinitions
     */
    @builder(ActionUsage, 1000)
    protected redefineStateSubactions(node: ActionUsageMeta, _document: LangiumDocument): void {
        const parent = node.parent();
        if (!parent?.is(StateSubactionMembership)) return;
        this.redefineFirstIf(node, (member) => {
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
    protected redefineTransitionUsageFeatures(
        node: TransitionUsageMeta,
        document: LangiumDocument
    ): void {
        const collect = (
            type: TransitionUsageMeta,
            out: Partial<Record<TransitionFeatureKind, FeatureMeta>>
        ): number => {
            let found = 0;
            if (!("trigger" in out) && type.accepter) {
                out.trigger = type.accepter.element();
                ++found;
            }

            if (!("effect" in out) && type.effect) {
                out.effect = type.effect.element();
                ++found;
            }

            if (!("guard" in out) && type.guard) {
                out.guard = type.guard.element();
                ++found;
            }

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
        findBases(node, bases);

        const owned: Partial<Record<TransitionFeatureKind, FeatureMeta>> = {};
        collect(node, owned);

        const redefine = (k: TransitionFeatureKind, fallback: string): void => {
            const current = owned[k];
            if (!current) return;
            let feature = bases[k];
            if (!feature) {
                feature = this.findLibraryElement(
                    node,
                    fallback,
                    document,
                    Feature,
                    "Could not find implicit redefinition"
                );
            }
            if (feature) {
                const specialization = RedefinitionMeta.create(this.util.idProvider, document, {
                    isImplied: true,
                });
                current.addHeritage([specialization, feature]);
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
    @builder(MetadataFeature)
    protected linkAnnotations(
        node: CommentMeta | MetadataFeatureMeta,
        document: LangiumDocument
    ): void {
        // references don't exist in model, only in parsed AST
        const ast = node.ast();
        if (!ast) return;
        const linker = this.linker(document.uri);
        ast.about.forEach((ref) => {
            const target = ref.targetRef;
            if (!target) return;
            const element = linker.linkReference(target, document);
            if (element) {
                ref.$meta["setElement"](element);
                element["addExplicitAnnotatingElement"](node);
            }
        });
    }

    /**
     * Setup implicit feature typings from assigned values
     */
    @builder(Feature)
    protected addFeatureValueTypings(node: FeatureMeta, document: LangiumDocument): void {
        const expression = node.value?.element();
        if (
            !expression ||
            node.direction !== "none" ||
            node.specializations().some((s) => !s.isImplied)
        )
            return;

        this.buildTree(expression, document);
        const type = this.findType(node, expression.returnType(), document);
        if (!type || !type.is(Feature)) return;

        const specialization = SubsettingMeta.create(this.util.idProvider, document, {
            isImplied: true,
        });
        node.addHeritage([specialization, type]);

        // TODO: feature write performance / binding connector as in spec
    }

    @builder(InvocationExpression)
    protected setupInvocationArgs(node: InvocationExpressionMeta, document: LangiumDocument): void {
        const children = node.ownedElements().toArray();
        // need to build all children recursively because reference resolution
        // may depend on a child left of it
        children.forEach((m) => this.buildTree(m, document));
        node["_args"] = node.arguments();
    }

    @builder(FeatureReferenceExpression)
    protected linkFeatureReferenceExpression(
        node: FeatureReferenceExpressionMeta,
        document: LangiumDocument
    ): void {
        if (node.expression) this.preLinkModel(node.expression, document);
    }

    @builder(Relationship, -1000)
    protected linkRelationship(node: RelationshipMeta, document: LangiumDocument): void {
        const ast = node.ast();
        if (!ast) return;

        const linker = this.linker(document.uri);
        if (ast.targetRef) {
            node["setElement"](linker.linkReference(ast.targetRef, document));
        }

        if (ast.sourceRef) {
            const source = linker.linkReference(ast.sourceRef, document);
            if (source) node["setSource"](source);
        }
    }

    @builder(MultiplicityRange)
    protected lazilyEvaluateMultiplicityBounds(
        node: MultiplicityRangeMeta,
        _document: LangiumDocument
    ): void {
        const expr = node.range?.element();
        if (!expr) {
            node["setBounds"](undefined);
            return;
        }

        const evaluator = this.evaluator;
        node["setBounds"](function (): Bounds | undefined {
            const range = expr ? evaluator.evaluate(expr, node.owner() ?? node) : undefined;
            if (!range || isExpressionError(range)) {
                return undefined;
            }

            const lower = range.at(0);
            if (lower === undefined) {
                return undefined;
            }
            const bounds: Bounds = {};
            let defaultUpper: number | undefined;
            if (typeof lower === "number") {
                bounds.lower = lower;
                defaultUpper = lower;
            } else if (typeof lower === "object" && lower.is(LiteralInfinity)) {
                bounds.lower = 0;
                defaultUpper = Number.MAX_SAFE_INTEGER;
            }

            if (range.length < 2) {
                bounds.upper = defaultUpper;
                return bounds;
            }

            const upper = range.at(-1);
            if (typeof upper === "number") bounds.upper = upper;
            else if (typeof upper === "object" && upper.is(LiteralInfinity))
                bounds.upper = Number.MAX_SAFE_INTEGER;
            return bounds;
        });
    }

    @builder(VariantMembership, 5)
    protected addImplicitVariantSpecialization(
        node: VariantMembershipMeta,
        document: LangiumDocument
    ): void {
        const owner = node.owner();
        const element = node.finalElement();
        if (element && owner?.isAny(Usage, Definition) && owner.isVariation) {
            const options: RelationshipOptions<UsageMeta, FeatureMeta> = {
                isImplied: true,
            };
            const specialization = owner.is(Usage)
                ? SubsettingMeta.create(this.util.idProvider, document, options)
                : FeatureTypingMeta.create(this.util.idProvider, document, options);
            element.addHeritage([specialization, owner]);
        }
    }

    @builder(OccurrenceUsage, 5)
    protected addImplicitOccurrenceUsageTyping(
        node: OccurrenceUsageMeta,
        document: LangiumDocument
    ): void {
        if (!node.portionKind || node.specializations(FeatureTyping).length !== 0) return;

        const owner = node.owner();

        const options: RelationshipOptions<UsageMeta, FeatureMeta> = {
            isImplied: true,
        };

        if (owner?.is(OccurrenceDefinition)) {
            node.addHeritage([
                FeatureTypingMeta.create(this.util.idProvider, document, options),
                owner,
            ]);
        } else if (owner?.is(OccurrenceUsage)) {
            node.addHeritage([
                SubsettingMeta.create(this.util.idProvider, document, options),
                owner,
            ]);
        }
    }

    @builder(Connector)
    protected addImplicitConnectorFeaturingType(
        node: ConnectorMeta,
        document: LangiumDocument
    ): void {
        if (node.owningType || node.featuredBy.length > 0) return;
        const context = node.contextType();
        if (!context) return;
        const featuring = TypeFeaturingMeta.create(this.util.idProvider, document, {
            isImplied: true,
        });
        node.addFeatureRelationship([featuring, context]);
    }

    @builder(Connector)
    protected addConnectorEndSubsettings(node: ConnectorMeta, document: LangiumDocument): void {
        for (const end of node.connectorEnds()) {
            const expression = stream(end.featureMembers())
                .filter(BasicMetamodel.is(FeatureMembership))
                .map((m) => m.element())
                .filter(BasicMetamodel.is(Expression))
                .head();
            if (!expression) continue;

            this.buildTree(expression, document);

            const result = expression.resultParameter()?.element();
            if (!result) continue;
            const subsetting = SubsettingMeta.create(this.util.idProvider, document, {
                isImplied: true,
            });
            end.addHeritage([subsetting, result]);
        }
    }

    @builder(ItemFlowEnd)
    protected addItemFlowEndSubsetting(node: ItemFlowEndMeta, document: LangiumDocument): void {
        if (node.specializations(Subsetting).some((s) => !s.isImplied)) return;
        const feature = node
            .featureMembers()
            .find((m) => m.is(OwningMembership))
            ?.element();
        if (!feature) return;

        // child feature would not have been setup yet, do it now
        this.preLinkModel(feature, document);

        feature
            .types(Redefinition)
            .limit(1)
            .map((t) => t.owner())
            .filter(BasicMetamodel.is(Feature))
            .forEach((f) => {
                const subsetting = SubsettingMeta.create(this.util.idProvider, document, {
                    isImplied: true,
                });
                node.addHeritage([subsetting, f]);
            });
    }

    @builder(ItemFlowEnd)
    protected addItemFlowEndMemberRedefinition(
        node: ItemFlowEndMeta,
        document: LangiumDocument
    ): void {
        const owner = node.owner();
        if (!owner?.is(Feature)) return;

        const feature = node
            .featureMembers()
            .find((m) => m.is(OwningMembership))
            ?.element();
        if (!feature) return;

        const index = owner
            .featureMembers()
            .filter((m) => m.is(EndFeatureMembership) || m.element()?.isEnd)
            .indexOf(node.parent() as MembershipMeta<FeatureMeta>);
        if (index !== 0 && index !== 1) return;

        const implicitName = implicitIndex.get(
            node.nodeType(),
            index === 0 ? "sourceOutput" : "targetInput"
        );
        if (!implicitName) return;
        const implicit = this.findLibraryElement(
            node,
            implicitName,
            document,
            Feature,
            "Could not find implicit item flow end redefinition"
        );
        if (!implicit) return;

        const redef = RedefinitionMeta.create(this.util.idProvider, document, {
            isImplied: true,
        });
        feature.addHeritage([redef, implicit]);
    }

    @builder(TransitionUsage)
    protected setupTransitionUsageReferenceUsageMembers(
        node: TransitionUsageMeta,
        document: LangiumDocument
    ): void {
        // setup transition link
        {
            const link = node.transitionLinkFeature();
            if (link?.is(ReferenceUsage)) {
                const target = this.findLibraryElement(
                    node,
                    "TransitionPerformances::TransitionPerformance::transitionLink",
                    document,
                    Feature,
                    "Could not find implicit transition link feature"
                );

                if (target) {
                    const redef = RedefinitionMeta.create(this.util.idProvider, document, {
                        isImplied: true,
                    });
                    link.addHeritage([redef, target]);
                }
            }
        }

        // setup accepter payload parameter
        {
            const payload = node.payloadParameter();
            const parameter = node.accepterPayloadParameter();
            if (payload?.is(ReferenceUsage) && parameter) {
                // make sure that the specialized type is set up so that
                // reference resolution doesn't break
                this.preLinkModel(parameter, document);

                const subsetting = SubsettingMeta.create(this.util.idProvider, document, {
                    isImplied: true,
                });
                payload.addHeritage([subsetting, parameter]);
                if (parameter.name) payload["setName"](parameter.name);
            }
        }
    }

    // executed first so that featuring context can be computed
    @builder(SuccessionAsUsage, -10000)
    protected setupSuccessionAsUsageEnds(
        node: SuccessionAsUsageMeta,
        document: LangiumDocument
    ): void {
        const ends = node.connectorEnds();

        for (const [index, getter] of [
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            [0, () => node.previousFeature((model) => this.preLinkModel(model, document))],
            [1, node.targetFeature],
        ] as const) {
            const end = ends.at(index);
            if (!end) continue;
            this.preLinkModel(end, document);

            const references = end.specializations().some((r) => r.is(ReferenceSubsetting));
            if (references) continue;

            const member = getter.call(node);
            if (!member) continue;
            this.preLinkModel(member, document);
            const feature = member?.element();
            if (feature) {
                this.preLinkModel(feature, document);
                const subsetting = ReferenceSubsettingMeta.create(this.util.idProvider, document, {
                    isImplied: true,
                });
                end.addHeritage([subsetting, feature]);
            }
        }
    }

    @builder(MembershipImport, 10000)
    protected cacheImportedName(node: MembershipImportMeta, _document: LangiumDocument): void {
        const ast = node.ast();

        // element is imported by the name as it appears in text
        let name = ast
            ? ast.targetRef?.parts.at(-1)?.$refText
            : node.element()?.name ?? node.element()?.shortName;
        if (!name) return;
        name = sanitizeName(name);

        const children = node.owner()?.["_memberLookup"];
        if (!children) return;

        // don't replace existing names
        if (children.has(name)) return;
        children.set(name, node);
    }

    @builder(Dependency, 1000)
    protected collectDependencyReferences(node: DependencyMeta, document: LangiumDocument): void {
        const ast = node.ast();
        if (!ast) return;

        const linker = this.linker(document.uri);
        node.client.push(
            ...stream(ast.client)
                .map((client) => linker.linkReference(client, document))
                .nonNullable()
        );
        node.supplier.push(
            ...stream(ast.supplier)
                .map((supplier) => linker.linkReference(supplier, document))
                .nonNullable()
        );
    }

    @builder(OperatorExpression, -1)
    protected addOperatorExpressionTyping(
        node: OperatorExpressionMeta,
        document: LangiumDocument
    ): void {
        const func = node.getFunction();
        if (!func) return;

        const element = this.findLibraryElement(
            node,
            func,
            document,
            Type,
            "Could not find operator expression type"
        );

        if (!element) return;

        const typing = FeatureTypingMeta.create(this.util.idProvider, document, {
            isImplied: true,
        });
        node.addHeritage([typing, element]);
    }

    @builder(TypeFeaturing, 1000)
    protected addNonDeclarationTypeFeaturing(
        node: TypeFeaturingMeta,
        _document: LangiumDocument
    ): void {
        if (!node.parent()?.is(OwningMembership)) return;

        const src = node.source();
        if (!src) return;
        (src as TypeMeta)["_typeRelationships"].push(node);
    }

    @builder([ItemFlow, FlowConnectionUsage], 1000)
    protected setFlowEndDirections(
        node: ItemFlowMeta | FlowConnectionUsageMeta,
        _document: LangiumDocument
    ): void {
        const ends = node.ends;

        const setDirection = (
            end: EndFeatureMembershipMeta | undefined,
            direction: FeatureDirectionKind
        ): void => {
            const mem = end?.element().children[0];
            if (mem?.is(FeatureMembership)) {
                mem.element().direction = direction;
            }
        };

        setDirection(ends[0], "out");
        setDirection(ends[1], "in");
    }

    /**
     * Construct the node fully by linking all its children and optionally specialized types
     * @param node AST node to construct
     * @param document document that owns {@link node}
     * @param specializations if true, also construct base types
     */
    protected buildTree(
        node: ElementMeta,
        document: LangiumDocument,
        specializations = true
    ): void {
        if (node.setupState === "completed") return;

        const linker = this.linker(document.uri);
        for (const child of streamModel(node)) {
            this.preLinkModel(child, document);

            const ast = child.ast();
            if (ast) linker.linkNode(ast, document);
        }

        if (!node.is(Type) || !specializations) return;
        node.allTypes().forEach((t) => {
            const doc = t.document;
            if (doc && t && t !== node) this.buildTree(t, doc, false);
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
        node: ElementMeta,
        type: string | TypeMeta | undefined,
        document: LangiumDocument
    ): TypeMeta | undefined {
        if (!type) return;
        if (typeof type !== "string") return type;
        return this.findLibraryElement(node, type, document, Type, "Could not find library type");
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
    protected findLibraryElement<K extends SysMLType>(
        node: ElementMeta,
        qualifiedName: string,
        document: LangiumDocument,
        type: K,
        notFoundMessage: string
    ): SysMLInterface<K>["$meta"] | undefined {
        const element = this.indexManager.findGlobalElement(qualifiedName, document, true);
        if (!element?.is(type)) {
            document.modelDiagnostics.add(node, {
                element: node,
                message: `${notFoundMessage} '${qualifiedName}'`,
                severity: "error",
                info: {},
            });
            return;
        }

        this.preLinkModel(element);
        return element;
    }

    /**
     * Helper function that collects implicit base types for {@link node}
     * @param node Element to collect base types for
     * @param document document that owns {@link node}
     * @returns qualified names of implicit base types
     */
    protected getImplicitSpecializations(
        node: ElementMeta,
        document: LangiumDocument
    ): GeneralType[] {
        const names: GeneralType[] = [];

        for (const general of node.defaultGeneralTypes()) {
            const name = typeof general == "string" ? general : general.type;
            const implicitName = implicitIndex.get(node.nodeType(), name);

            if (!implicitName) {
                document.modelDiagnostics.add(node, {
                    element: node,
                    message: `Could not find implicit specialization for ${node.nodeType()} (${name})`,
                    severity: "error",
                    info: {},
                });
                continue;
            }

            names.push(
                typeof general == "string"
                    ? implicitName
                    : { type: implicitName, specialization: general.specialization }
            );
        }

        return names;
    }

    /**
     * Setup implicit base types for {@link node}
     * @param node {@link Type} to add implicit specialization to
     * @param document document that owns  {@link node}
     * @param type type assertion for valid specialization types
     */
    protected addImplicits<V extends SubtypeKeys<Type>, T extends SysMLInterface<V>["$meta"]>(
        node: T,
        document: LangiumDocument,
        type: V
    ): void {
        if (document.buildOptions?.standardLibrary === "none") return;

        const kind = node.specializationKind();
        for (const general of this.getImplicitSpecializations(node, document)) {
            const name = typeof general == "string" ? general : general.type;
            const implicit = this.findLibraryElement(
                node,
                name,
                document,
                type,
                `Could not find implicit specialization for ${kind}`
            );

            if (implicit && implicit !== node) {
                const specialization = this.constructMetamodel(
                    typeof general == "string" ? kind : general.specialization,
                    document
                ) as InheritanceMeta;
                specialization["_isImplied"] = true;
                node.addHeritage([specialization, implicit]);
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
    protected redefineFirstIf<T extends SubtypeKeys<Inheritance>>(
        feature: FeatureMeta,
        predicate: (member: MembershipMeta<FeatureMeta>) => boolean,
        kind?: T
    ): void {
        const owner = feature.owner() as TypeMeta;
        for (const type of owner.allTypes(kind)) {
            const baseFeature = type.featureMembers().find(predicate)?.element();
            if (!baseFeature) continue;
            const specialization = RedefinitionMeta.create(this.util.idProvider, feature.document, {
                isImplied: true,
            });
            feature.addHeritage([specialization, baseFeature]);
            return;
        }
    }
}
