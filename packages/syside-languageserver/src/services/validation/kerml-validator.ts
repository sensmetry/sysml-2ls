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

import { MultiMap, Properties, Stream, stream } from "langium";
import * as ast from "../../generated/ast";
import {
    AnyOperator,
    AssociationMeta,
    AssociationStructMeta,
    BasicMetamodel,
    BindingConnectorMeta,
    ClassMeta,
    ConnectorMeta,
    DataTypeMeta,
    ElementFilterMembershipMeta,
    ElementMeta,
    ExpressionMeta,
    FeatureChainExpressionMeta,
    FeatureChainingMeta,
    FeatureMeta,
    FeatureReferenceExpressionMeta,
    FeatureValueMeta,
    FunctionMeta,
    InteractionMeta,
    InvocationExpressionMeta,
    ItemFlowEndMeta,
    ItemFlowMeta,
    LibraryPackageMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MultiplicityMeta,
    MultiplicityRangeMeta,
    NamespaceMeta,
    OperatorExpressionMeta,
    OPERATORS,
    ParameterMembershipMeta,
    RedefinitionMeta,
    RelationshipMeta,
    ResultExpressionMembershipMeta,
    ReturnParameterMembershipMeta,
    SpecializationMeta,
    SubsettingMeta,
    typeArgument,
    TypeMeta,
} from "../../model";
import { SysMLSharedServices } from "../services";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { SubtypeKeys, SysMLInterface, SysMLType } from "../sysml-ast-reflection";
import {
    ModelDiagnosticInfo,
    ModelValidationAcceptor,
    Severity,
    validateKerML,
} from "./validation-registry";
import { NonNullable } from "../../utils";
import { SysMLFileSystemProvider } from "../shared";

/**
 * Implementation of custom validations.
 */
export class KerMLValidator {
    protected readonly index: SysMLIndexManager;
    protected readonly fs: SysMLFileSystemProvider;

    constructor(services: SysMLSharedServices) {
        this.index = services.workspace.IndexManager;
        this.fs = services.workspace.FileSystemProvider;
    }

    @validateKerML(ast.Element)
    validateElementIsImpliedIncluded(node: ElementMeta, accept: ModelValidationAcceptor): void {
        if (
            !node.isImpliedIncluded &&
            node
                .ownedElements()
                .filter(BasicMetamodel.is(ast.Relationship))
                .some((r) => r.isImplied)
        ) {
            accept("error", "Element cannot have implied relationships included.", {
                element: node,
                code: "validateElementIsImpliedIncluded",
            });
        }
    }

    @validateKerML(ast.Namespace, { bounds: [ast.InlineExpression] })
    validateNamespaceDistinguishability(
        element: NamespaceMeta,
        accept: ModelValidationAcceptor
    ): void {
        const duplicates = new MultiMap<
            string,
            [ElementMeta, Properties<ast.Element> | undefined]
        >();

        // for performance reasons, only check direct members
        for (const child of element.ownedElements()) {
            let member: MembershipMeta;
            let target: ElementMeta;

            if (child.is(ast.Membership)) {
                // skip non-owning non-alias members
                if (child.nodeType() === ast.Membership && !child.isAlias) return;
                const element = child.isAlias ? child : child.element();
                /* istanbul ignore next */
                if (!element) continue;
                member = child;
                target = element;
            } else if (child.is(ast.MembershipImport) && !child.isRecursive) {
                const element = child.element();
                /* istanbul ignore next */
                if (!element) continue;
                member = element;
                target = child;
            } else {
                // not checking recursive/namespace imports
                continue;
            }

            if (member.name) {
                duplicates.add(member.name, [target, "declaredName"]);
            }
            if (member.shortName && member.shortName !== member.name) {
                duplicates.add(member.shortName, [target, "declaredShortName"]);
            }
        }

        for (const [name, members] of duplicates.entriesGroupedByKey()) {
            if (members.length < 2) continue;
            for (const [target, property] of members) {
                accept("warning", `Duplicate of another member named ${name}.`, {
                    element: target,
                    code: "validateNamespaceDistinguishability",
                    property,
                });
            }
        }

        // TODO: inherited members
    }

    @validateKerML(ast.Specialization)
    validateSpecializationSpecificNotConjugated(
        node: SpecializationMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.isImplied) return;
        const specific = node.source();
        if (specific?.is(ast.Type) && specific.specializations(ast.Conjugation).length > 0) {
            const parsed = node.ast();
            accept("error", "Conjugated type cannot be a specialized type.", {
                element: node,
                code: "validateSpecializationSpecificNotConjugated",
                property: parsed?.sourceRef
                    ? "sourceRef"
                    : parsed?.sourceChain
                      ? "sourceChain"
                      : "source",
            });
        }
    }

    @validateKerML(ast.Type)
    validateTypeAtMostOneConjugator(node: TypeMeta, accept: ModelValidationAcceptor): void {
        const conjugations = node.specializations(ast.Conjugation);
        if (conjugations.length > 1) {
            this.apply("warning", conjugations, "Type can have at most one conjugator.", accept, {
                code: "validateTypeAtMostOneConjugator",
            });
        }
    }

    private readonly typeRelationshipNotSelf: Record<string, { code: string; message: string }> = {
        [ast.Differencing]: {
            code: "validateTypeDifferencingTypesNotSelf",
            message: "A Type cannot be one of its own differencingTypes.",
        },
        [ast.Intersecting]: {
            code: "validateTypeIntersectingTypesNotSelf",
            message: "A Type cannot be one of its own intersectingTypes.",
        },
        [ast.Unioning]: {
            code: "validateTypeUnioningTypesNotSelf",
            message: "A Type cannot be one of its own unioningTypes.",
        },
        [ast.FeatureChaining]: {
            code: "validateFeatureChainingFeaturesNotSelf",
            message: "A Feature cannot be one of its own chainingFeatures.",
        },
    };

    @validateKerML(ast.Type, { sysml: false })
    validateTypeRelatesTypesNotSelf(node: TypeMeta, accept: ModelValidationAcceptor): void {
        node.typeRelationships.forEach((r) => {
            if (r.element() !== node) return;
            const info = this.typeRelationshipNotSelf[r.nodeType()];

            /* istanbul ignore next */
            if (!info) return;

            accept("error", info.message, {
                element: r,
                code: info.code,
            });
        });
    }

    private readonly typeRelationshipNotOne: Record<string, { code: string; message: string }> = {
        [ast.Differencing]: {
            code: "validateTypeOwnedDifferencingNotOne",
            message: "A Type cannot have exactly one ownedDifferencing.",
        },
        [ast.Intersecting]: {
            code: "validateTypeOwnedIntersectingNotOne",
            message: "A Type cannot have exactly one ownedIntersecting.",
        },
        [ast.Unioning]: {
            code: "validateTypeOwnedUnioningNotOne",
            message: "A Type cannot have exactly one ownedUnioning.",
        },
        [ast.FeatureChaining]: {
            code: "validateFeatureChainingFeatureNotOne",
            message: "A Feature cannot have exactly one chainingFeatures.",
        },
    };

    @validateKerML(ast.Type)
    validateTypeRelationshipNotOne(node: TypeMeta, accept: ModelValidationAcceptor): void {
        const relationships: Record<string, RelationshipMeta[]> = {};
        node.typeRelationships.forEach((r) => {
            (relationships[r.nodeType()] ??= []).push(r);
        });

        Object.entries(relationships).forEach(([type, relationships]) => {
            const info = this.typeRelationshipNotOne[type];
            if (!info || relationships.length !== 1) return;
            this.apply("error", relationships, info.message, accept, {
                code: info.code,
            });
        });
    }

    // sysml has no multiplicity types/members outside of declaration so this
    // would always pass
    @validateKerML(ast.Type, { sysml: false })
    validateTypeOwnedMultiplicity(node: TypeMeta, accept: ModelValidationAcceptor): void {
        // even though multiplicity is a subtype of feature, it is parsed as a
        // non-feature element...
        const multiplicities = stream(node.children)
            .filter(BasicMetamodel.is(ast.OwningMembership))
            .map((m) => m.element())
            .nonNullable()
            .filter(BasicMetamodel.is(ast.Multiplicity))
            .tail(node.multiplicity ? 0 : 1);

        this.apply(
            "warning",
            multiplicities,
            "A Type may have at most one ownedMember that is a Multiplicity.",
            accept,
            { code: "validateTypeOwnedMultiplicity" }
        );
    }

    // validateEndFeatureMembershipIsEnd - model implicitly ensures this, no
    // need to check

    @validateKerML(ast.Multiplicity, { sysml: false })
    validateMultiplicityDomain(node: MultiplicityMeta, accept: ModelValidationAcceptor): void {
        const owningType = node.owner();
        /* istanbul ignore next */
        if (!owningType?.is(ast.Type)) return;

        const multi = node.featuredBy;
        if (owningType.is(ast.Feature)) {
            const owner = owningType.featuredBy;
            if (
                multi !== owner &&
                multi.length !== owner.length &&
                multi.some((tf) => !owner.includes(tf))
            ) {
                this.apply(
                    "warning",
                    multi,
                    "Feature multiplicity featuringTypes must be the same as those of the Feature itself.",
                    accept,
                    { code: "validateFeatureMultiplicityDomain" }
                );
            }
        } else if (multi.length !== 0) {
            this.apply(
                "warning",
                multi,
                "Classifier multiplicity featuringTypes must be empty.",
                accept,
                {
                    code: "validateClassifierMultiplicityDomain",
                }
            );
        }
    }

    @validateKerML(ast.Feature)
    validateFeatureTyping(node: FeatureMeta, accept: ModelValidationAcceptor): void {
        if (
            node.allTypings().length === 0 &&
            // in case failed to link
            !node.typeRelationships.find((r) => r.is(ast.FeatureTyping))
        ) {
            accept("error", "A Feature must be typed by at least one type.", {
                element: node,
                property: "heritage",
                // not in the spec
                code: "validateFeatureTyping",
            });
        }
    }

    @validateKerML(ast.Feature)
    validateFeatureOwnedReferenceSubsetting(
        node: FeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const refs = node.specializations(ast.ReferenceSubsetting);
        if (refs.length > 1) {
            this.apply(
                "warning",
                refs,
                "A Feature must have at most one ownedSubsetting that is a ReferenceSubsetting.",
                accept,
                { code: "validateFeatureOwnedReferenceSubsetting" }
            );
        }
    }

    // this is broken until linking can be done to our custom model structures w/o langium AstNode
    // @validateKerML(ast.Redefinition)
    // validateRedefinitionDirectionConformance(
    //     node: RedefinitionMeta,
    //     accept: ModelValidationAcceptor
    // ): void {
    //     const redefining = node.source() as FeatureMeta | undefined;
    //     const redefined = node.element();

    //     if (!redefining || !redefined || redefined.parent() === node) return;

    //     const dstFeaturings = redefined.featuredBy;
    //     const direction = redefining.direction;
    //     for (const featuring of dstFeaturings) {
    //         const redefinedDir = featuring.directionOf(redefined);
    //         if (
    //             ((redefinedDir == "in" || redefinedDir == "out") && direction != redefinedDir) ||
    //             (redefinedDir == "inout" && direction == "none")
    //         ) {
    //             accept("error", "Redefining feature must have a compatible direction", {
    //                 element: node,
    //                 code: "validateRedefinitionDirectionConformance",
    //             });
    //         }
    //     }
    // }

    @validateKerML(ast.FeatureChaining)
    validateFeatureChainingFeatureConformance(
        node: FeatureChainingMeta,
        accept: ModelValidationAcceptor
    ): void {
        const feature = node.element();
        if (!feature) return;
        const chainings = (node.source() as FeatureMeta).chainings;
        const i = chainings.indexOf(node);
        if (i > 0) {
            const previous = chainings[i - 1].element();
            /* istanbul ignore next */
            if (!previous) return;
            if (!feature.featuredBy.every((t) => previous.conforms(t))) {
                accept(
                    "error",
                    "A chainingFeature must be featured by the previous chainingFeature",
                    { element: node, code: "validateFeatureChainingFeatureConformance" }
                );
            }
        }
    }

    @validateKerML(ast.Redefinition)
    validateRedefinitionFeaturingTypes(
        node: RedefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const redefining = node.source() as FeatureMeta | undefined;
        const redefined = node.element();

        if (!redefining || !redefined || redefined.parent() === node) return;

        const srcFeaturings = redefining.featuredBy;
        const dstFeaturings = redefined.featuredBy;
        if (srcFeaturings.every((t) => dstFeaturings.includes(t))) {
            accept(
                "error",
                srcFeaturings.length === 0
                    ? "A package level Feature cannot redefine other Features."
                    : "Owner of redefining feature cannot be the same as owner of the redefined feature.",
                {
                    element: node,
                    code: "validateRedefinitionFeaturingTypes",
                }
            );
        }
    }

    validateSubsettingMultiplicityConformance(
        node: SubsettingMeta,
        subsetting: FeatureMeta,
        subsetted: FeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const bounds = subsetting.multiplicity?.element()?.bounds;
        const end = subsetting.isEnd;

        if (!bounds) return;
        // only need to check bounds if either both are ends or neither are ends
        if (end !== subsetted.isEnd) return;

        const subBounds = subsetted.multiplicity?.element()?.bounds;
        /* istanbul ignore next */
        if (!subBounds) return;

        const [src, dst] =
            node.nodeType() === ast.Redefinition
                ? ["Redefining", "redefined"]
                : ["Subsetting", "subsetted"];
        if (node.nodeType() === ast.Redefinition && !end) {
            if (
                bounds.lower !== undefined &&
                subBounds.lower !== undefined &&
                bounds.lower < subBounds.lower
            ) {
                accept(
                    "warning",
                    `${src} feature should not have smaller multiplicity lower bound (${bounds.lower}) than ${dst} feature (${subBounds.lower})`,
                    {
                        element: subsetting,
                        property: "multiplicity",
                        code: "validateRedefinitionMultiplicityConformance",
                    }
                );
            }
        }

        if (
            bounds.upper !== undefined &&
            subBounds.upper !== undefined &&
            bounds.upper > subBounds.upper
        ) {
            accept(
                "warning",
                `${src} feature should not have larger multiplicity upper bound (${bounds.upper}) than ${dst} feature (${subBounds.upper})`,
                {
                    element: subsetting,
                    property: "multiplicity",
                    code: "validateSubsettingMultiplicityConformance",
                }
            );
        }
    }

    validateSubsettingUniquenessConformance(
        node: SubsettingMeta,
        subsetting: FeatureMeta,
        subsetted: FeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!subsetted.isNonUnique && subsetting.isNonUnique) {
            accept(
                "error",
                node.nodeType() === ast.Redefinition
                    ? "Redefining feature cannot be nonunique if redefined feature is unique"
                    : "Subsetting feature cannot be nonunique if subsetted feature is unique",
                {
                    element: node,
                    property: "sourceRef",
                    code: "validateSubsettingUniquenessConformance",
                }
            );
        }
    }

    validateSubsettingFeaturingTypes(
        node: SubsettingMeta,
        subsetting: FeatureMeta,
        subsetted: FeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const subsettedTypes = subsetted.featuredBy;
        if (
            subsettedTypes.length > 0 &&
            !subsettedTypes.every((t) => this.isAccessibleFrom(subsetting, t))
        ) {
            accept(
                subsetting.owner()?.is(ast.ItemFlowEnd) ? "error" : "warning",
                "Invalid subsetting, must be an accessible feature (use dot notation for nesting).",
                { element: node, code: "validateSubsettingFeaturingTypes" }
            );
        }
    }

    protected isAccessibleFrom(feature: FeatureMeta, type: TypeMeta): boolean {
        const featurings = feature.featuredBy;
        return (
            (featurings.length == 0 && type.qualifiedName == "Base::Anything") ||
            featurings.some((featuring) => {
                return (
                    featuring.conforms(type) ||
                    (featuring.is(ast.Feature) && this.isAccessibleFrom(featuring, type))
                );
            })
        );
    }

    @validateKerML(ast.Subsetting)
    validateSubsetting(node: SubsettingMeta, accept: ModelValidationAcceptor): void {
        if (node.isImplied) return;

        const subsetting = node.source() as FeatureMeta | undefined;
        const subsetted = node.element();
        if (!subsetting || !subsetted) return;

        // connectors have separate validation
        if (subsetting.owner()?.is(ast.Connector) || subsetted.owner()?.is(ast.Connector)) return;

        this.validateSubsettingMultiplicityConformance(node, subsetting, subsetted, accept);
        this.validateSubsettingUniquenessConformance(node, subsetting, subsetted, accept);
        this.validateSubsettingFeaturingTypes(node, subsetting, subsetted, accept);
    }

    @validateKerML(ast.DataType, { sysml: false })
    validateDatatypeSpecialization(node: DataTypeMeta, accept: ModelValidationAcceptor): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization)
                .filter((s) => s.element()?.isAny(ast.Class, ast.Association)),
            "A DataType must not specialize a Class or an Association.",
            accept,
            { code: "validateDatatypeSpecialization", property: "targetRef" }
        );
    }

    @validateKerML(ast.Class, { sysml: false, bounds: [ast.AssociationStructure, ast.Interaction] })
    validateClassSpecialization(node: ClassMeta, accept: ModelValidationAcceptor): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization)
                .filter((s) => s.element()?.isAny(ast.DataType, ast.Association)),
            "A Class must not specialize a DataType or an Association.",
            accept,
            { code: "validateClassSpecialization", property: "targetRef" }
        );
    }

    @validateKerML(ast.AssociationStructure, { sysml: false })
    @validateKerML(ast.Interaction, { sysml: false })
    validateAssocStructSpecialization(
        node: AssociationStructMeta | InteractionMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization)
                .filter((s) => s.element()?.isAny(ast.DataType)),
            `An ${
                node.is(ast.Interaction) ? ast.Interaction : ast.AssociationStructure
            } must not specialize a DataType.`,
            accept,
            { code: "validateClassSpecialization", property: "targetRef" }
        );
    }

    @validateKerML(ast.Connector)
    @validateKerML(ast.Association)
    validateBinarySpecialization(
        node: AssociationMeta | ConnectorMeta,
        accept: ModelValidationAcceptor
    ): void {
        // only checking owned ends so that the error doesn't propagate to all
        // subtypes
        const ends = node.ownedEnds();
        if (ends.length > 2 && node.conforms("Links::BinaryLink")) {
            const isConn = node.is(ast.Connector);
            accept(
                "error",
                `Invalid binary ${
                    isConn ? ast.Connector : ast.Association
                } - cannot have more than two ends.`,
                {
                    element: node,
                    code: isConn
                        ? "validateConnectorBinarySpecialization"
                        : "validateAssociationBinarySpecialization",
                }
            );
        }
    }

    @validateKerML(ast.Connector)
    @validateKerML(ast.Association)
    validateRelatedTypes(
        node: AssociationMeta | ConnectorMeta,
        accept: ModelValidationAcceptor
    ): void {
        // abstract connectors can have less than 2 ends
        if (node.isAbstract) return;

        if (node.allEnds().length < 2) {
            const isConn = node.is(ast.Connector);
            accept(
                "error",
                `Invalid concrete  ${
                    isConn ? ast.Connector : ast.Association
                }, must have at least 2 related elements`,
                {
                    element: node,
                    code: isConn
                        ? "validateConnectorRelatedFeatures"
                        : "validateAssociationRelatedTypes",
                }
            );
        }
    }

    // validateAssociationStructureIntersection - is implicitly ensured by the
    // type hierarchy

    @validateKerML(ast.BindingConnector)
    validateBindingConnectorIsBinary(
        node: BindingConnectorMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.relatedFeatures().length !== 2) {
            accept("error", "A BindingConnector must be binary.", {
                element: node,
                property: "ends",
                code: "validateBindingConnectorIsBinary",
            });
        }
    }

    @validateKerML(ast.BindingConnector)
    validateBindingConnectorTypeConformance(
        node: BindingConnectorMeta,
        accept: ModelValidationAcceptor
    ): void {
        const related = node.relatedFeatures().filter(NonNullable);
        // skip invalid binding connectors
        if (related.length !== 2) return;

        const notConformsBoolean = (i: number): boolean | undefined => {
            const owningType = related[i].owningType;
            return (
                owningType &&
                this.isBooleanExpression(owningType) &&
                !related[i]
                    .allTypings()
                    .some((t) => this.index.conforms(t, "Performances::BooleanEvaluation"))
            );
        };

        if (
            !this.conformsSymmetrical(related[0].allTypings(), related[1].allTypings()) ||
            notConformsBoolean(0) ||
            notConformsBoolean(1)
        ) {
            accept("warning", "Bound features should have conforming types", {
                element: node,
                code: "validateBindingConnectorTypeConformance",
            });
        }
    }

    @validateKerML(ast.Connector)
    validateConnectorEnds(node: ConnectorMeta, accept: ModelValidationAcceptor): void {
        const featuringTypes = node.featuredBy;

        const ends = node.connectorEnds();
        const skip = !node.owningType && node.is(ast.ItemFlow) && node.owner()?.is(ast.Feature);
        if (skip) return;
        ends.forEach((end, index) => {
            // no guarantee that the user has correctly used only a single
            // reference subsetting so only check the head
            const related = end.specializations(ast.ReferenceSubsetting).at(0)?.element() as
                | FeatureMeta
                | undefined;

            if (
                !related ||
                (featuringTypes.length == 0
                    ? related.isFeaturedWithin(undefined)
                    : featuringTypes.every((t) => related?.isFeaturedWithin(t)))
            ) {
                return;
            }

            accept(
                "warning",
                `Invalid connector end #${index}, should be an accessible feature (use dot notation for nesting)`,
                {
                    element: end,
                    code: "checkConnectorTypeFeaturing",
                }
            );
        });
    }

    // this is implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ParameterMembership)
    validateParameterMembershipOwningType(
        node: ParameterMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.owner();
        if (owner && !owner.isAny(ast.Behavior, ast.Step)) {
            accept("error", "A ParameterMembership must be owned by a Behavior or a Step.", {
                element: node,
                code: "validateParameterMembershipOwningType",
            });
        }
    }

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.SysMLFunction)
    @validateKerML(ast.Expression)
    validateReturnParameterMembershipCount(
        node: ExpressionMeta | FunctionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const isFn = node.is(ast.SysMLFunction);
        const results = node.children.filter(BasicMetamodel.is(ast.ReturnParameterMembership));
        if (results.length > 1)
            this.apply(
                "error",
                results,
                `${
                    isFn ? "A Function" : "An Expression"
                } must own at most one ReturnParameterMembership.`,
                accept,
                {
                    code: isFn
                        ? "validateFunctionReturnParameterMembership"
                        : "validateExpressionReturnParameterMembership",
                }
            );
    }

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ReturnParameterMembership)
    @validateKerML(ast.ResultExpressionMembership)
    validateResultExpressionMembershipOwningType(
        node: ResultExpressionMembershipMeta | ReturnParameterMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.owner();
        if (owner && !owner.isAny(ast.SysMLFunction, ast.Expression)) {
            accept(
                "error",
                `The owningType of a ${node.nodeType()} must be a Function or Expression.`,
                {
                    element: node,
                    code:
                        node.nodeType() === ast.ReturnParameterMembership
                            ? "validateReturnParameterMembershipOwningType"
                            : "validateResultExpressionMembershipOwningType",
                }
            );
        }
    }

    // validateReturnParameterMembershipParameterHasDirectionOut - implicitly
    // ensured by the model

    // validateCollectExpressionOperator - implicitly ensured by the model

    @validateKerML(ast.FeatureChainExpression)
    validateFeatureChainExpressionFeatureConformance(
        node: FeatureChainExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const target = node.targetFeature();
        const left = node.args.at(0);

        /* istanbul ignore next */
        if (!target || !left) return;
        const ns = left.is(ast.Expression) ? this.index.findType(left.returnType()) : left;
        /* istanbul ignore next */
        if (!ns) return;

        if (target.featuredBy.length > 0 && !target.featuredBy.some((t) => ns.conforms(t)))
            accept("error", "FeatureChainExpression target must be accessible.", {
                element: node,
                property: "children",
                index: 0, // left is in `operands`
                code: "validateFeatureChainExpressionFeatureConformance",
            });
    }

    @validateKerML(ast.FeatureReferenceExpression)
    /* istanbul ignore next (grammar and type system doesn't allow anything
    other than feature to be used) */
    validateFeatureReferenceExpressionReferentIsFeature(
        node: FeatureReferenceExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const target = node.expression?.element();
        if (target && !target.is(ast.Feature))
            accept("error", "Invalid feature reference expression, must refer to a feature", {
                element: node,
                property: "expression",
                code: "validateFeatureReferenceExpressionReferentIsFeature",
            });
    }

    @validateKerML(ast.InvocationExpression)
    validateInvocationExpressionArgs(
        node: InvocationExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const type = node.invokes() ?? this.index.findType(node.getFunction());
        if (!type) return;

        const expected = new Set(
            type
                .allTypes(undefined, true)
                .flatMap((t) => t.ownedFeatures())
                .nonNullable()
                .filter((f) => f.direction !== "out")
        );

        // nothing to check
        if (expected.size === 0) return;

        const visited = new Set<TypeMeta>();
        node.ownedInputParameters().forEach((param) => {
            const redefinitions = param.types(ast.Redefinition).toArray() as FeatureMeta[];
            if (redefinitions.length === 0) return;
            const redefinedParams = redefinitions.filter((t) => expected.has(t));
            if (redefinedParams.length === 0) {
                accept(
                    "error",
                    "Input parameter must redefine a parameter of the expression type.",
                    { element: param, code: "validateInvocationExpressionParameterRedefinition" }
                );
            } else if (redefinedParams.some((f) => visited.has(f))) {
                accept("error", "Two parameters cannot redefine the same type parameter.", {
                    element: param,
                    code: "validateInvocationExpressionNoDuplicateParameterRedefinition",
                });
            }

            redefinedParams.forEach((p) => visited.add(p));
        });
    }

    @validateKerML(ast.OperatorExpression)
    validateOperatorExpressionCastConformance(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.operator !== OPERATORS.AS) return;

        const left = node.args.at(0);
        const type = typeArgument(node);
        /* istanbul ignore next */
        if (!type || !left?.isAny(ast.Expression, ast.SysMLFunction)) return;

        const arg = this.index.findType(left.returnType());
        /* istanbul ignore next */
        if (!arg) return;
        const argTypes = arg.is(ast.Feature) ? arg.allTypings() : [arg];
        const types = type.is(ast.Feature) ? type.allTypings() : [type];
        if (!this.conformsSymmetrical(argTypes, types)) {
            accept("error", `Cast argument should have conforming types.`, {
                element: node,
                code: "validateOperatorExpressionCastConformance",
            });
        }
    }

    @validateKerML(ast.OperatorExpression, {
        sysml: false,
        bounds: [ast.CollectExpression, ast.SelectExpression, ast.FeatureChainExpression],
    })
    validateOperatorExpressionBracketOperator(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.operator === OPERATORS.QUANTITY) {
            accept("warning", "Use #(...) operator instead.", {
                element: node,
                property: "operator",
                code: "validateOperatorExpressionBracketOperator",
            });
        }
    }

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ItemFlow)
    validateItemFlowItemFeature(node: ItemFlowMeta, accept: ModelValidationAcceptor): void {
        this.atMostOne(
            "error",
            node.ownedFeatures().filter(BasicMetamodel.is(ast.ItemFeature)),
            accept,
            "An ItemFlow must have at most one ownedFeature that is an ItemFeature.",
            { code: "validateItemFlowItemFeature" }
        );
    }

    // validateItemFlowEndIsEnd - implicitly ensured by the model

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ItemFlowEnd)
    validateItemFlowEndNestedFeature(node: ItemFlowEndMeta, accept: ModelValidationAcceptor): void {
        const features = node.ownedFeatureMemberships().count();
        if (features !== 1) {
            accept("error", "An ItemFlowEnd must have exactly one ownedFeature.", {
                element: node,
                code: "validateItemFlowEndNestedFeature",
            });
        }
    }

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ItemFlowEnd)
    validateItemFlowEndOwningType(node: ItemFlowEndMeta, accept: ModelValidationAcceptor): void {
        if (!node.owningType?.is(ast.ItemFlow)) {
            accept("error", "The owningType of an ItemFlowEnd must be an ItemFlow.", {
                element: node,
                code: "validateItemFlowEndOwningType",
            });
        }
    }

    @validateKerML(ast.ItemFlowEnd)
    validateItemFlowEndSubsetting(node: ItemFlowEndMeta, accept: ModelValidationAcceptor): void {
        if (
            !node.specializations(ast.Subsetting).some((sub) => sub.nodeType() !== ast.Redefinition)
        ) {
            accept("error", "Cannot identify ItemFlowEnd (use dot notation).", {
                element: node,
                code: "validateItemFlowEndSubsetting",
            });
        } else if (!node.specializations(ast.Subsetting).some((sub) => !sub.isImplied)) {
            const child = node.ownedFeatures().head();
            if (child && child.specializations(ast.Redefinition).some((r) => !r.isImplied))
                accept("warning", "ItemFlowEnd should use dot notation.", {
                    element: node,
                    code: "validateItemFlowEndImplicitSubsetting",
                });
        }
    }

    @validateKerML(ast.FeatureValue)
    validateFeatureValueOverriding(node: FeatureValueMeta, accept: ModelValidationAcceptor): void {
        const feature = node.owner();
        if (!feature?.is(ast.Feature)) {
            return;
        }

        if (
            feature
                .allRedefinedFeatures()
                .map((f) => f.value)
                .some((fv) => fv && fv != node && !fv.isDefault)
        ) {
            accept("error", "Cannot override a non-default feature value.", {
                element: node,
                code: "validateFeatureValueOverriding",
            });
        }
    }

    @validateKerML(ast.MultiplicityRange)
    validateMultiplicityRangeBoundResultTypes(
        node: MultiplicityRangeMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (
            node.range &&
            !this.isInteger(node.range.element(), KerMLValidator.IntegerRangeOperators)
        ) {
            accept(
                "error",
                "The results of the bound Expression(s) of a MultiplicityRange must be Naturals.",
                { element: node.range, code: "validateMultiplicityRangeBoundResultTypes" }
            );
        }
    }

    @validateKerML(ast.MetadataFeature, { bounds: [ast.MetadataUsage] })
    validateMetadataFeatureMetaclass(
        node: MetadataFeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.Metaclass,
            accept,
            "MetadataFeature must be typed by exactly one Metaclass.",
            { code: "validateMetadataFeatureMetaclass" }
        );
    }

    @validateKerML(ast.MetadataFeature)
    validateMetadataFeatureMetaclassNotAbstract(
        node: MetadataFeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            "error",
            node.specializations(ast.FeatureTyping).filter((s) => s.element()?.isAbstract),
            "MetadataFeature must be typed by concrete types.",
            accept,
            { code: "validateMetadataFeatureMetaclassNotAbstract" }
        );
    }

    @validateKerML(ast.MetadataFeature)
    validateMetadataFeatureAnnotatedElement(
        node: MetadataFeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const annotatedElementFeatures = node
            .allFeatures()
            .map((m) => m.element())
            .nonNullable()
            .filter((f) => !f.isAbstract && f.conforms("Metaobjects::Metaobject::annotatedElement"))
            .toArray();

        if (annotatedElementFeatures.length === 0) return;

        node.annotatedElements().forEach((element) => {
            const meta = element.metaclass?.types().head();
            /* istanbul ignore next */
            if (!meta) return;
            if (
                !annotatedElementFeatures.find((f) =>
                    f.types(ast.FeatureTyping).every((t) => meta.conforms(t))
                )
            )
                accept("error", `Cannot annotate ${meta.name}.`, {
                    element: node,
                    code: "validateMetadataFeatureAnnotatedElement",
                });
        });
    }

    @validateKerML(ast.MetadataFeature)
    validateMetadataFeatureBody(node: TypeMeta, accept: ModelValidationAcceptor): void {
        node.ownedFeatures().forEach((feature) => {
            if (
                !feature
                    .types(ast.Redefinition)
                    .map((t) => t.owner())
                    .find((t) => node.conforms(t as TypeMeta))
            ) {
                accept(
                    "error",
                    "MetadataFeature owned features must redefine owning-type feature.",
                    {
                        element: feature,
                        code: "validateMetadataFeatureBody",
                    }
                );
            }

            const fvalue = feature.value?.element();
            if (fvalue && !fvalue.isModelLevelEvaluable()) {
                accept(
                    "error",
                    "MetadataFeature owned feature values must be model-level evaluable.",
                    { element: fvalue, code: "validateMetadataFeatureBody" }
                );
            }

            this.validateMetadataFeatureBody(feature, accept);
        });
    }

    @validateKerML(ast.ElementFilterMembership)
    validateElementFilterMembership(
        node: ElementFilterMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const expr = node.element();
        const func = expr.getFunction();

        if (func && !expr?.isModelLevelEvaluable())
            accept("error", "The condition Expression must be model-level evaluable", {
                element: expr,
                code: "validatePackageElementFilterIsModelLevelEvaluable",
            });
        else if (!this.isBoolean(expr)) {
            accept(
                "error",
                "The result parameter of the condition Expression must directly or indirectly specialize ScalarValues::Boolean.",
                {
                    element: node,
                    property: "target",
                    code: "validatePackageElementFilterIsBoolean",
                }
            );
        }
    }

    @validateKerML(ast.LibraryPackage)
    checkStandardLibraryPackage(node: LibraryPackageMeta, accept: ModelValidationAcceptor): void {
        if (!node.isStandard) return;
        const emit = (): void => {
            accept("error", "User library packages should not be marked as standard.", {
                element: node,
                property: "isStandard",
                code: "validateLibraryPackageNotStandard",
            });
        };

        const std = this.fs.standardLibrary;
        if (!std) {
            emit();
            return;
        }

        if (!node.document.uriString.startsWith(std.toString())) {
            emit();
        }
    }

    protected atMostOneMember<T extends SubtypeKeys<ast.Membership>>(
        node: NamespaceMeta,
        type: T,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<SysMLInterface<T>["$meta"]>, "element">
    ): void {
        this.atMostOne(
            "error",
            node.featureMembers().filter(BasicMetamodel.is(type)),
            accept,
            message,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            info as any
        );
    }

    protected atMostOne<T extends ElementMeta>(
        severity: Severity,
        items: Iterable<T>,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): void {
        const matches = Array.from(items);

        if (matches.length < 2) return;
        this.apply(severity, matches, message, accept, info);
    }

    protected apply<T extends ElementMeta>(
        severity: Severity,
        elements: Pick<Stream<T>, "forEach">,
        message: string,
        accept: ModelValidationAcceptor,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): void {
        elements.forEach((element) => accept(severity, message, { ...info, element }));
    }

    protected conformsSymmetrical(left: TypeMeta[], right: TypeMeta[]): boolean {
        // return true if there's at least one type in either array that
        // conforms with every type in the other array
        return (
            left.every((l) => right.some((r) => r.conforms(l))) ||
            right.every((r) => left.some((l) => l.conforms(r)))
        );
    }

    protected expressionResult(expr: ExpressionMeta): string | TypeMeta | undefined {
        let result = expr.returnType();
        const func = expr.getFunction();
        if (!result && func) {
            if (typeof func === "string") {
                const element = this.index.findGlobalElement(func);
                if (element?.isAny(ast.SysMLFunction, ast.Expression))
                    result = element.returnType();
            } else {
                result = func.returnType();
            }
        }

        return result;
    }

    protected readonly BooleanOperators: AnyOperator[] = [
        OPERATORS.NOT,
        OPERATORS.XOR,
        OPERATORS.AND,
        OPERATORS.BITWISE_AND,
        OPERATORS.OR,
        OPERATORS.BITWISE_OR,
    ];

    protected isBoolean(expr: ExpressionMeta): boolean {
        if (expr.is(ast.LiteralBoolean)) {
            return true;
        }

        const result = this.expressionResult(expr);

        if (result && this.index.conforms(result, "ScalarValues::Boolean")) return true;
        return (
            expr.is(ast.OperatorExpression) &&
            this.BooleanOperators.includes(expr.operator) &&
            expr.args.every((arg) => !arg || (arg.is(ast.Expression) && this.isBoolean(arg)))
        );
    }

    protected readonly ComparisonOperators: AnyOperator[] = [
        OPERATORS.EQUALS,
        OPERATORS.SAME,
        OPERATORS.NOT_EQUALS,
        OPERATORS.NOT_SAME,
        OPERATORS.IS_TYPE,
        OPERATORS.HAS_TYPE,
        OPERATORS.LESS,
        OPERATORS.LESS_EQUAL,
        OPERATORS.GREATER,
        OPERATORS.GREATER_EQUAL,
    ];

    protected isBooleanExpression(expr: TypeMeta): boolean {
        if (!expr.is(ast.Expression)) {
            return false;
        }
        if (expr.isAny(ast.LiteralBoolean, ast.Predicate)) {
            // short-circuit for known always-true cases
            return true;
        }

        if (expr.is(ast.OperatorExpression) && this.ComparisonOperators.includes(expr.operator)) {
            return true;
        }

        const result = this.expressionResult(expr);

        if (result && this.index.conforms(result, "Performances::BooleanEvaluation")) return true;
        if (expr.is(ast.FeatureReferenceExpression)) {
            const referent = expr.expression?.element();
            if (!referent?.is(ast.Expression)) return false;
            if (this.isBoolean(referent)) return true;

            const refResult = this.index.findType(this.expressionResult(referent));
            return Boolean(refResult?.is(ast.Expression) && this.isBoolean(refResult));
        }

        return false;
    }

    protected static readonly IntegerOperators: AnyOperator[] = [
        OPERATORS.MINUS,
        OPERATORS.PLUS,
        OPERATORS.MULTIPLY,
        OPERATORS.MODULO,
        OPERATORS.EXPONENT_1,
        OPERATORS.EXPONENT_2,
    ];

    protected static readonly IntegerRangeOperators: AnyOperator[] = [
        ...this.IntegerOperators,
        OPERATORS.RANGE,
    ];

    protected isInteger(
        expr: ExpressionMeta,
        operators = KerMLValidator.IntegerOperators
    ): boolean {
        if (expr.is(ast.LiteralInfinity)) {
            return true;
        }
        if (expr.is(ast.LiteralNumber)) {
            return expr.isInteger;
        }

        const result = this.expressionResult(expr);

        if (result && this.index.conforms(result, "ScalarValues::Integer")) return true;
        return (
            expr.is(ast.OperatorExpression) &&
            operators.includes(expr.operator) &&
            expr.args.every((arg) => this.isInteger(arg))
        );
    }

    protected validateExactlyOneTyping<T extends FeatureMeta>(
        node: T,
        bound: SysMLType,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): boolean {
        const typings = node.allTypings();
        if (typings.length !== 1 || !typings.find((t) => t.is(bound))) {
            accept("error", message, { ...info, element: node });
            return false;
        }

        return true;
    }
}
