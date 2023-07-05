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

import { MultiMap, Properties, stream } from "langium";
import * as ast from "../../generated/ast";
import {
    AssociationMeta,
    BasicMetamodel,
    BindingConnectorMeta,
    ClassifierMeta,
    ConnectorMeta,
    ElementFilterMembershipMeta,
    ElementMeta,
    ExpressionMeta,
    FeatureChainExpressionMeta,
    FeatureChainingMeta,
    FeatureMeta,
    FeatureReferenceExpressionMeta,
    implicitIndex,
    InheritanceMeta,
    InvocationExpressionMeta,
    ItemFlowMeta,
    LibraryPackageMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    NamespaceMeta,
    OperatorExpressionMeta,
    RelationshipMeta,
    ReturnParameterMembershipMeta,
    SubsettingMeta,
    TypeMeta,
} from "../../model";
import { SysMLSharedServices } from "../services";
import { SysMLConfigurationProvider } from "../shared/workspace/configuration-provider";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { SysMLType } from "../sysml-ast-reflection";
import { ModelValidationAcceptor, validateKerML } from "./validation-registry";

/**
 * Implementation of custom validations.
 */
export class KerMLValidator {
    protected readonly index: SysMLIndexManager;
    protected readonly config: SysMLConfigurationProvider;

    constructor(services: SysMLSharedServices) {
        this.index = services.workspace.IndexManager;
        this.config = services.workspace.ConfigurationProvider;
    }

    @validateKerML(ast.Type, { sysml: false })
    checkTypeRelationships(type: TypeMeta, accept: ModelValidationAcceptor): void {
        const relationships: Partial<Record<string, RelationshipMeta[]>> = {};
        type.typeRelationships.reduce((map, r) => {
            (map[r.nodeType()] ??= <RelationshipMeta[]>[]).push(r);
            return map;
        }, relationships);

        for (const type of [ast.Unioning, ast.Intersecting, ast.Differencing]) {
            const array = relationships[type];
            if (array && array.length === 1) {
                accept("error", `A single ${type.toLowerCase()} relationship is not allowed`, {
                    element: array[0],
                });
            }
        }
    }

    @validateKerML(ast.Subsetting)
    checkSubsettingMultiplicities(
        subsetting: SubsettingMeta,
        accept: ModelValidationAcceptor
    ): void {
        const feature = subsetting.source() as FeatureMeta | undefined;
        if (!feature) return;

        if (feature.owner()?.is(ast.Connector)) {
            // association features have multiplicity 1..1 implicitly,
            // multiplicity works differently
            return;
        }
        const nonunique = feature.isNonUnique;
        const bounds = feature.multiplicity?.element()?.bounds;
        const end = feature.isEnd;

        const sub = subsetting.element();
        if (!sub) return;
        if (sub.owner()?.is(ast.Connector)) return;
        if (!sub.isNonUnique && nonunique) {
            accept(
                "error",
                `Subsetting feature must be unique as subsetted feature ${sub.qualifiedName} is unique`,
                { element: feature }
            );
        }

        if (!bounds) return;
        // only need to check bounds if either both are ends or neither are ends
        if (end !== sub.isEnd) return;

        const subBounds = sub.multiplicity?.element()?.bounds;
        if (!subBounds) return;

        if (subsetting.is(ast.Redefinition) && !end) {
            if (
                bounds.lower !== undefined &&
                subBounds.lower !== undefined &&
                bounds.lower < subBounds.lower
            ) {
                accept(
                    "warning",
                    `Multiplicity lower bound (${bounds.lower}) should be at least as large as the redefined feature lower bound (${subBounds.lower})`,
                    { element: feature, property: "multiplicity" }
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
                `Multiplicity upper bound (${bounds.upper}) should not be larger than the subsetted feature upper bound (${subBounds.upper})`,
                { element: feature, property: "multiplicity" }
            );
        }
    }

    @validateKerML(ast.Feature)
    checkFeatureChainingLength(feature: FeatureMeta, accept: ModelValidationAcceptor): void {
        const chainings = feature.typeRelationships.filter(BasicMetamodel.is(ast.FeatureChaining));
        if (chainings.length === 1) {
            accept("error", "Feature chain must be a chain of 2 or more features", {
                element: chainings[0],
            });
        }
    }

    @validateKerML(ast.Namespace, { bounds: [ast.InlineExpression] })
    checkUniqueNames(element: NamespaceMeta, accept: ModelValidationAcceptor): void {
        const names = new MultiMap<string, [MembershipMeta, Properties<ast.Element>]>();

        // for performance reasons, only check direct members
        for (const member of element.ownedElements()) {
            if (!member.is(ast.Membership)) continue;
            // skip non-owning memberships that are not aliases
            if (!member.is(ast.OwningMembership) && !member.isAlias()) continue;
            // skip over automatically named reference usages
            if (member.element()?.is(ast.ReferenceUsage)) continue;
            const name = member.name;
            if (name) names.add(name, [member, "declaredName"]);

            const short = member.shortName;
            if (short && short !== name) names.add(short, [member, "declaredShortName"]);
        }

        for (const [name, members] of names.entriesGroupedByKey()) {
            if (members.length < 2) continue;
            for (const [member, property] of members) {
                const node = member.isAlias() ? member : member.element();
                if (!node) continue;

                accept("error", `Duplicate member name ${name}`, {
                    element: node,
                    property,
                });
            }
        }
    }

    @validateKerML(ast.ReturnParameterMembership)
    validateReturnMembers(
        node: ReturnParameterMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.atMostOneMember(node, ast.ReturnParameterMembership, accept);
    }

    @validateKerML(ast.OperatorExpression, {
        sysml: false,
        bounds: [ast.CollectExpression, ast.SelectExpression, ast.FeatureChainExpression],
    })
    warnIndexingUsage(node: OperatorExpressionMeta, accept: ModelValidationAcceptor): void {
        if (node.operator === "'['") {
            accept("warning", "Invalid index expression, use #(...) operator instead.", {
                element: node,
                property: "operator",
            });
        }
    }

    @validateKerML(ast.ElementFilterMembership)
    validateElementFilterMembership(
        node: ElementFilterMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const expr = node.element();
        if (!expr) return;
        const func = expr.getFunction();

        if (func && !expr.isModelLevelEvaluable())
            accept("error", "Invalid filter expression, must be model-level evaluable", {
                element: node,
                property: "target",
            });
        else {
            const isBoolean = (expr: ExpressionMeta): boolean => {
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

                if (result && this.index.conforms(result, "ScalarValues::Boolean")) return true;
                return (
                    expr.is(ast.OperatorExpression) &&
                    ["'not'", "'xor'", "'&'", "'|'"].includes(expr.operator) &&
                    expr.args.every((arg) => !arg || (arg.is(ast.Expression) && isBoolean(arg)))
                );
            };

            if (!isBoolean(expr)) {
                accept("error", "Invalid filter expression, must return boolean", {
                    element: node,
                    property: "target",
                });
            }
        }
    }

    @validateKerML(ast.LibraryPackage)
    checkStandardLibraryPackage(node: LibraryPackageMeta, accept: ModelValidationAcceptor): void {
        if (!node.isStandard) return;
        const emit = (): void => {
            accept(
                "error",
                "Invalid library package, user library packages should not marked standard",
                { element: node, property: "isStandard" }
            );
        };

        const std = this.config.stdlibUriString;
        if (!std) {
            emit();
            return;
        }

        if (!node.document.uriString.startsWith(std)) {
            emit();
        }
    }

    @validateKerML(ast.Classifier)
    validateDefaultClassifierSupertype(
        node: ClassifierMeta,
        accept: ModelValidationAcceptor
    ): void {
        const supertype = implicitIndex.get(node.nodeType(), node.defaultSupertype());
        if (!node.conforms(supertype)) {
            accept(
                "error",
                `Invalid classifier, must directly or indirectly specialize ${supertype}`,
                { element: node }
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
            accept("error", "Invalid feature, must be typed by at least one type", {
                element: node,
            });
        }
    }

    @validateKerML(ast.Feature)
    validateReferenceSubsettings(node: FeatureMeta, accept: ModelValidationAcceptor): void {
        const refs = node.specializations(ast.ReferenceSubsetting);
        if (refs.length > 1) {
            this.apply(refs, "Invalid reference subsetting, at most one is allowed", accept);
        }
    }

    @validateKerML(ast.MetadataFeature)
    validateMetadataFeatureTypeNotAbstract(
        node: MetadataFeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            node.specializations(ast.FeatureTyping).filter((s) => s.element()?.isAbstract),
            "Invalid metadata feature typing, must have a concrete type",
            accept
        );
    }

    @validateKerML(ast.MetadataFeature)
    validateAnnotatedElementFeaturesConform(
        node: MetadataFeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const annotatedElementFeatures = node
            .allFeatures()
            .map((m) => m.element())
            .nonNullable()
            .filter((f) => !f.isAbstract)
            .filter((f) => f.conforms("Metaobjects::Metaobject::annotatedElement"))
            .toArray();

        if (annotatedElementFeatures.length === 0) return;

        for (const element of node.annotatedElements()) {
            const meta = element.metaclass?.types().head();
            if (!meta) continue;
            if (
                !annotatedElementFeatures.find((f) =>
                    f.types(ast.FeatureTyping).every((t) => meta.conforms(t))
                )
            )
                accept("error", `Invalid metadata feature, cannot annotate ${meta.name}`, {
                    element: node,
                });
        }
    }

    @validateKerML(ast.MetadataFeature)
    validateMetadataFeatureBody(node: TypeMeta, accept: ModelValidationAcceptor): void {
        for (const feature of stream(node.featureMembers())
            .filter(BasicMetamodel.is(ast.OwningMembership))
            .map((m) => m.element())
            .nonNullable()) {
            if (
                !feature
                    .types(ast.Redefinition)
                    .map((t) => t.owner())
                    .find((t) => node.conforms(t as TypeMeta))
            ) {
                accept(
                    "error",
                    "Invalid metadata body feature, must redefine owning type feature",
                    { element: feature }
                );
            }

            const fvalue = feature.value?.element();
            if (fvalue && !fvalue.isModelLevelEvaluable()) {
                accept(
                    "error",
                    "Invalid metadata body feature value, must be model-level evaluable",
                    { element: fvalue }
                );
            }

            this.validateMetadataFeatureBody(feature, accept);
        }
    }

    @validateKerML(ast.FeatureChaining)
    validateChainingFeaturingTypes(
        node: FeatureChainingMeta,
        accept: ModelValidationAcceptor
    ): void {
        const feature = node.element();
        if (!feature) return;
        const chainings = (node.source() as FeatureMeta).chainings;
        const i = chainings.indexOf(node);
        if (i > 0) {
            const previous = chainings[i - 1].element();
            if (!previous) return;
            if (!feature.featuredBy.every((t) => previous.conforms(t))) {
                accept(
                    "error",
                    "Invalid feature chaining, chaining feature featuring types do not conform with the previous chaining feature featuring types",
                    { element: node }
                );
            }
        }
    }

    @validateKerML(ast.FeatureReferenceExpression)
    /* istanbul ignore next (grammar doesn't allow anything other than feature to be used) */
    validateFeatureReferenceExpressionTarget(
        node: FeatureReferenceExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const target = node.expression?.element();
        if (target && !target.is(ast.Feature))
            accept("error", "Invalid feature reference expression, must refer to a valid feature", {
                element: node,
                property: "expression",
            });
    }

    @validateKerML(ast.FeatureChainExpression)
    validateFeatureChainExpressionTarget(
        node: FeatureChainExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const target = node.args.at(1);
        const left = node.args.at(0);
        if (!target || !left) return;
        const ns = left.is(ast.Expression) ? this.index.findType(left.returnType()) : left;
        if (!ns) return;

        if (target.featuredBy.length > 0 && !target.featuredBy.some((t) => ns.conforms(t)))
            accept("error", "Invalid feature chain expression, must refer to a valid feature", {
                element: node,
                property: "children",
                index: 1,
            });
    }

    @validateKerML(ast.InvocationExpression)
    validateInvocationArgs(node: InvocationExpressionMeta, accept: ModelValidationAcceptor): void {
        const type = node.invokes() ?? this.index.findType(node.getFunction());
        if (!type) return;

        const expected = new Set(type.inputParameters());

        // nothing to check
        if (expected.size === 0) return;

        const received = node.ownedInputParameters();
        const visited = new Set<TypeMeta>();

        for (const param of received) {
            const redefinitions = param.types(ast.Redefinition).toArray() as FeatureMeta[];
            if (redefinitions.length === 0) continue;
            const redefinedParams = redefinitions.filter((t) => expected.has(t));
            if (redefinedParams.length === 0) {
                accept(
                    "error",
                    "Invalid invocation expression argument, cannot redefine an output parameter",
                    { element: param }
                );
            } else if (redefinedParams.some((f) => visited.has(f))) {
                accept(
                    "error",
                    "Invalid invocation expression argument, cannot bind to the same parameter multiple times",
                    { element: param }
                );
            }

            redefinedParams.forEach((p) => visited.add(p));
        }
    }

    @validateKerML(ast.OperatorExpression)
    validateCastExpression(node: OperatorExpressionMeta, accept: ModelValidationAcceptor): void {
        if (node.operator !== "'as'") return;

        const type = node.args.at(1);
        if (!type) return;
        const left = node.args[0];
        if (!left?.isAny(ast.Expression, ast.SysMLFunction)) return;

        const arg = this.index.findType(left.returnType());
        if (!arg) return;
        const argTypes = arg.is(ast.Feature) ? arg.allTypings() : [arg];
        const types = type.allTypings();
        if (!this.conformsSymmetrical(argTypes, types)) {
            accept(
                "error",
                `Invalid cast expression, cannot cast ${arg.qualifiedName} to ${types
                    .map((t) => t.qualifiedName)
                    .join(", ")}`,
                { element: node }
            );
        }
    }

    // sysml has no multiplicity types/members outside of declaration so this
    // would always pass
    @validateKerML(ast.Type, { sysml: false })
    validateMultiplicityCount(node: TypeMeta, accept: ModelValidationAcceptor): void {
        // even though multiplicity is a subtype of feature, it is parsed as a
        // non-feature element...
        const multiplicities = stream(node.children)
            .filter(BasicMetamodel.is(ast.OwningMembership))
            .map((m) => m.element())
            .nonNullable()
            .filter(BasicMetamodel.is(ast.Multiplicity))
            .tail(node.multiplicity ? 0 : 1);

        this.apply(multiplicities, "Invalid type, too many multiplicities", accept);
    }

    @validateKerML(ast.Relationship, { bounds: [ast.Type, ast.TypeRelationship, ast.Dependency] })
    /* istanbul ignore next (grammar doesn't allow triggering this validation) */
    validateRelationshipEnds(node: RelationshipMeta, accept: ModelValidationAcceptor): void {
        if (!node.element() && !node.ast()?.targetRef) {
            accept("error", "Invalid relationship, must have at least 2 related elements", {
                element: node,
            });
        }
    }

    @validateKerML(ast.FeatureRelationship)
    @validateKerML(ast.Inheritance)
    /* istanbul ignore next (grammar doesn't allow triggering this validation) */
    validateSpecializationEnds(
        node: ast.FeatureRelationship["$meta"] | InheritanceMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.element() && !node.ast()?.targetRef) {
            accept("error", "Invalid relationship, must have at least 2 related elements", {
                element: node,
            });
        }
    }

    @validateKerML(ast.Connector)
    @validateKerML(ast.Association)
    validateConnectorEndCount(
        node: ConnectorMeta | AssociationMeta,
        accept: ModelValidationAcceptor
    ): void {
        // abstract connectors can have less than 2 ends
        if (node.isAbstract) return;

        if (node.allEnds().length < 2) {
            accept("error", `Invalid ${node.nodeType()}, must have at least 2 related elements`, {
                element: node,
            });
        }
    }

    @validateKerML(ast.Connector)
    validateConnectorEnds(node: ConnectorMeta, accept: ModelValidationAcceptor): void {
        this.checkConnectorEnds(node, node, accept);
    }

    @validateKerML(ast.BindingConnector)
    validateBindingConnectorEnds(
        node: BindingConnectorMeta,
        accept: ModelValidationAcceptor
    ): void {
        const related = node.relatedFeatures();
        // skip invalid binding connectors
        if (related.length !== 2) return;

        if (!this.conformsSymmetrical(related[0].allTypings(), related[1].allTypings())) {
            accept(
                "warning",
                "Invalid binding connector, bound features should have conforming types",
                { element: node }
            );
        }
    }

    @validateKerML(ast.ItemFlow)
    validateItemFlowEnds(node: ItemFlowMeta, accept: ModelValidationAcceptor): void {
        node.itemFlowEnds().forEach((end) => {
            const subsettings = end.specializations(ast.Subsetting);
            if (!subsettings.some((sub) => !sub.is(ast.Redefinition))) {
                accept(
                    "error",
                    "Invalid flow end, cannot identify item flow end, use dot notation",
                    { element: end }
                );
            } else if (!subsettings.some((sub) => !sub.isImplied)) {
                const owning = end.featureMembers().find((m) => m.is(ast.OwningMembership));
                if (!owning) return;
                const feature = owning.element();
                if (!feature) return;
                if (feature.types(ast.Redefinition).head()) {
                    accept("warning", "Invalid item flow end, flow ends should use dot notation", {
                        element: end,
                    });
                }
            }
        });
    }

    @validateKerML(ast.Subsetting)
    validateSubsettingFeatureTypeConformance(
        node: SubsettingMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.isImplied) return;
        const subsetting = node.source() as FeatureMeta | undefined;
        const subsetted = node.element();
        if (!subsetting || !subsetted) return;

        // connectors have separate validation
        if (subsetting.owner()?.is(ast.Connector) || subsetted.owner()?.is(ast.Connector)) return;

        const subsettingTypes = subsetting.featuredBy;
        const subsettedTypes = subsetted.featuredBy;
        if (
            node.is(ast.Redefinition) &&
            subsetted.parent() !== node &&
            subsettedTypes.every((t) => subsettingTypes.includes(t)) &&
            subsettedTypes.length === subsettingTypes.length
        ) {
            if (subsettedTypes.length === 0) {
                accept(
                    "warning",
                    "Invalid redefinition, a package level feature should not be redefined",
                    { element: node }
                );
            } else {
                accept(
                    "warning",
                    "Invalid redefinition, owner of the redefining feature should not be the same as the owner of the redefined feature",
                    { element: node }
                );
            }
        } else if (
            subsettedTypes.length > 0 &&
            !subsettedTypes.every((t) =>
                subsettingTypes.some(
                    (f) => f.conforms(t) || (f.is(ast.Feature) && f.isFeaturedBy(t))
                )
            )
        ) {
            accept(
                subsetting.owner()?.is(ast.ItemFlowEnd) ? "error" : "warning",
                "Invalid subsetting, must be an accessible feature, use dot notation for nesting",
                { element: node }
            );
        }
    }

    private checkConnectorEnds(
        node: ConnectorMeta,
        source: TypeMeta,
        accept: ModelValidationAcceptor
    ): void {
        const featuringTypes = node.featuredBy;

        const ends = node.connectorEnds();
        ends.forEach((end, index) => {
            // no guarantee that the user has correctly used only a single
            // reference subsetting so only check the head
            const related = end.specializations(ast.ReferenceSubsetting).at(0)?.element() as
                | FeatureMeta
                | undefined;
            if (!related) return;
            if (related.featuredBy.length === 0) return;
            if (featuringTypes.some((type) => related.featuredBy.some((f) => type.conforms(f))))
                return;

            // needed later for implicit binding connectors (none constructed currently)
            // if (
            //     source.$meta.isAny(ast.FeatureReferenceExpression, ast.FeatureChainExpression) &&
            //     end.owner() === source.$meta
            // )
            //     return;

            accept(
                "warning",
                `Invalid connector end #${index}, should be an accessible feature (use dot notation for nesting)`,
                {
                    element: source === node ? end ?? node : source,
                }
            );
        });
    }

    protected atMostOneFeature(
        node: NamespaceMeta,
        type: SysMLType,
        accept: ModelValidationAcceptor
    ): void {
        this.atMostOne(
            stream(node.featureMembers())
                .map((m) => m.element())
                .nonNullable()
                .filter(BasicMetamodel.is(type)),
            accept,
            `At most one ${type} is allowed`
        );
    }

    protected atMostOneMember(
        node: MembershipMeta,
        type: SysMLType,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.parent();
        if (!owner?.is(ast.Namespace)) return;
        if (
            owner.featureMembers().reduce((count, member) => count + Number(member.is(type)), 0) > 1
        )
            accept("error", `At most one ${type} is allowed`, { element: node });
    }

    protected atMostOne(
        items: Iterable<ElementMeta>,
        accept: ModelValidationAcceptor,
        message: string
    ): void {
        const matches = Array.from(items);

        if (matches.length < 2) return;
        this.apply(matches, message, accept);
    }

    protected apply(
        elements: Iterable<ElementMeta>,
        message: string,
        accept: ModelValidationAcceptor
    ): void {
        for (const element of elements) {
            accept("error", message, { element });
        }
    }

    protected conformsSymmetrical(left: TypeMeta[], right: TypeMeta[]): boolean {
        // return true if there's at least one type in either array that
        // conforms with every type in the other array
        return (
            left.every((l) => right.some((r) => r.conforms(l))) ||
            right.every((r) => left.some((l) => l.conforms(r)))
        );
    }
}
