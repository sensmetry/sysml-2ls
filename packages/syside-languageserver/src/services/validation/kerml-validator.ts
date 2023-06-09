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
    getDocument,
    LangiumDocument,
    MultiMap,
    Properties,
    stream,
    ValidationAcceptor,
} from "langium";
import * as ast from "../../generated/ast";
import {
    ExpressionMeta,
    FeatureMeta,
    implicitIndex,
    MembershipMeta,
    Metamodel,
    TypeMeta,
} from "../../model";
import { SysMLSharedServices } from "../services";
import { SysMLConfigurationProvider } from "../shared/workspace/configuration-provider";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { SysMLType } from "../sysml-ast-reflection";
import { validateKerML } from "./validation-registry";

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
    checkTypeRelationships(type: ast.Type, accept: ValidationAcceptor): void {
        const relationships: Partial<Record<string, ast.Relationship[]>> = {};
        type.typeRelationships.reduce((map, r) => {
            (map[r.$type] ??= <ast.Relationship[]>[]).push(r);
            return map;
        }, relationships);

        for (const type of [ast.Unioning, ast.Intersecting, ast.Differencing]) {
            const array = relationships[type];
            if (array && array.length === 1) {
                accept("error", `A single ${type.toLowerCase()} relationship is not allowed`, {
                    node: array[0] as ast.Relationship,
                });
            }
        }
    }

    @validateKerML(ast.Subsetting)
    checkSubsettingMultiplicities(subsetting: ast.Subsetting, accept: ValidationAcceptor): void {
        const feature = subsetting.$meta.source()?.ast() as ast.Feature | undefined;
        if (!feature) return;

        if (feature.$meta.owner()?.is(ast.Connector)) {
            // association features have multiplicity 1..1 implicitly,
            // multiplicity works differently
            return;
        }
        const nonunique = feature.isNonunique;
        const bounds = feature.$meta.multiplicity?.element()?.bounds;
        const end = feature.$meta.isEnd;

        const sub = subsetting.$meta.element();
        if (!sub) return;
        if (sub.owner()?.is(ast.Connector)) return;
        if (!sub.isNonUnique && nonunique) {
            accept(
                "error",
                `Subsetting feature must be unique as subsetted feature ${sub.qualifiedName} is unique`,
                { node: feature }
            );
        }

        if (!bounds) return;
        // only need to check bounds if either both are ends or neither are ends
        if (end !== sub.isEnd) return;

        const subBounds = sub.multiplicity?.element()?.bounds;
        if (!subBounds) return;

        if (subsetting.$meta.is(ast.Redefinition) && !end) {
            if (
                bounds.lower !== undefined &&
                subBounds.lower !== undefined &&
                bounds.lower < subBounds.lower
            ) {
                accept(
                    "warning",
                    `Multiplicity lower bound (${bounds.lower}) should be at least as large as the redefined feature lower bound (${subBounds.lower})`,
                    { node: feature, property: "multiplicity" }
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
                { node: feature, property: "multiplicity" }
            );
        }
    }

    @validateKerML(ast.Feature)
    checkFeatureChainingLength(feature: ast.Feature, accept: ValidationAcceptor): void {
        const chainings = feature.typeRelationships.filter((r) => ast.isFeatureChaining(r));
        if (chainings.length === 1) {
            accept("error", "Feature chain must be a chain of 2 or more features", {
                node: chainings[0],
            });
        }
    }

    @validateKerML(ast.Namespace, { bounds: [ast.InlineExpression] })
    checkUniqueNames(element: ast.Namespace, accept: ValidationAcceptor): void {
        const names = new MultiMap<string, [MembershipMeta, Properties<ast.Element>]>();

        // for performance reasons, only check direct members
        for (const member of element.$meta.children) {
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
                const node = member.isAlias() ? member.ast() : member.element()?.ast();
                if (!node) continue;

                accept("error", `Duplicate member name ${name}`, {
                    node,
                    property,
                });
            }
        }
    }

    @validateKerML(ast.ReturnParameterMembership)
    validateReturnMembers(node: ast.ReturnParameterMembership, accept: ValidationAcceptor): void {
        this.atMostOneMember(node, ast.ReturnParameterMembership, accept);
    }

    @validateKerML(ast.OperatorExpression, {
        sysml: false,
        bounds: [ast.CollectExpression, ast.SelectExpression, ast.FeatureChainExpression],
    })
    warnIndexingUsage(node: ast.OperatorExpression, accept: ValidationAcceptor): void {
        if (node.operator === "[") {
            accept("warning", "Invalid index expression, use #(...) operator instead.", {
                node,
                property: "operator",
            });
        }
    }

    @validateKerML(ast.ElementFilterMembership)
    validateElementFilterMembership(
        node: ast.ElementFilterMembership,
        accept: ValidationAcceptor
    ): void {
        const expr = node.$meta.element();
        if (!expr) return;
        const func = expr.getFunction();

        if (func && !expr.isModelLevelEvaluable())
            accept("error", "Invalid filter expression, must be model-level evaluable", {
                node,
                property: "element",
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
                    node,
                    property: "element",
                });
            }
        }
    }

    @validateKerML(ast.LibraryPackage)
    checkStandardLibraryPackage(node: ast.LibraryPackage, accept: ValidationAcceptor): void {
        if (!node.isStandard) return;
        const emit = (): void => {
            accept(
                "error",
                "Invalid library package, user library packages should not marked standard",
                { node, property: "isStandard" }
            );
        };

        const std = this.config.stdlibUriString;
        if (!std) {
            emit();
            return;
        }

        let document: LangiumDocument;
        try {
            document = getDocument(node);
        } catch (_) {
            emit();
            return;
        }

        if (!document.uriString.startsWith(std)) {
            emit();
        }
    }

    @validateKerML(ast.Classifier)
    validateDefaultClassifierSupertype(node: ast.Classifier, accept: ValidationAcceptor): void {
        const supertype = implicitIndex.get(node.$type, node.$meta.defaultSupertype());
        if (!node.$meta.conforms(supertype)) {
            accept(
                "error",
                `Invalid classifier, must directly or indirectly specialize ${supertype}`,
                { node }
            );
        }
    }

    @validateKerML(ast.Feature)
    validateFeatureTyping(node: ast.Feature, accept: ValidationAcceptor): void {
        if (
            node.$meta.allTypings().length === 0 &&
            // in case failed to link
            !node.typeRelationships.find((r) => r.$meta.is(ast.FeatureTyping))
        ) {
            accept("error", "Invalid feature, must be typed by at least one type", { node });
        }
    }

    @validateKerML(ast.Feature)
    validateReferenceSubsettings(node: ast.Feature, accept: ValidationAcceptor): void {
        const refs = node.$meta.specializations(ast.ReferenceSubsetting);
        if (refs.length > 1) {
            this.apply(refs, "Invalid reference subsetting, at most one is allowed", accept);
        }
    }

    @validateKerML(ast.MetadataFeature)
    validateMetadataFeatureTypeNotAbstract(
        node: ast.MetadataFeature,
        accept: ValidationAcceptor
    ): void {
        this.apply(
            node.$meta.specializations(ast.FeatureTyping).filter((s) => s.element()?.isAbstract),
            "Invalid metadata feature typing, must have a concrete type",
            accept
        );
    }

    @validateKerML(ast.MetadataFeature)
    validateAnnotatedElementFeaturesConform(
        node: ast.MetadataFeature,
        accept: ValidationAcceptor
    ): void {
        const annotatedElementFeatures = node.$meta
            .allFeatures()
            .map((m) => m.element())
            .nonNullable()
            .filter((f) => !f.isAbstract)
            .filter((f) => f.conforms("Metaobjects::Metaobject::annotatedElement"))
            .toArray();

        if (annotatedElementFeatures.length === 0) return;

        for (const element of node.$meta.annotatedElements()) {
            const meta = element.metaclass?.types().head();
            if (!meta) continue;
            if (
                !annotatedElementFeatures.find((f) =>
                    f.types(ast.FeatureTyping).every((t) => meta.conforms(t))
                )
            )
                accept("error", `Invalid metadata feature, cannot annotate ${meta.name}`, { node });
        }
    }

    @validateKerML(ast.MetadataFeature)
    validateMetadataFeatureBody(node: ast.Type, accept: ValidationAcceptor): void {
        for (const feature of stream(node.$meta.featureMembers())
            .filter((m) => m.is(ast.OwningMembership))
            .map((m) => m.element())
            .nonNullable()) {
            if (
                !feature
                    .types(ast.Redefinition)
                    .map((t) => t.owner())
                    .find((t) => node.$meta.conforms(t as TypeMeta))
            ) {
                accept(
                    "error",
                    "Invalid metadata body feature, must redefine owning type feature",
                    { node: feature.ast() ?? node }
                );
            }

            const fvalue = feature.value?.element();
            if (fvalue && !fvalue.isModelLevelEvaluable()) {
                accept(
                    "error",
                    "Invalid metadata body feature value, must be model-level evaluable",
                    { node: fvalue.ast() ?? feature.ast() ?? node }
                );
            }

            const parsed = feature.ast();
            if (parsed) this.validateMetadataFeatureBody(parsed, accept);
        }
    }

    @validateKerML(ast.FeatureChaining)
    validateChainingFeaturingTypes(node: ast.FeatureChaining, accept: ValidationAcceptor): void {
        const feature = node.$meta.element();
        if (!feature) return;
        const chainings = (node.$meta.source() as FeatureMeta).chainings;
        const i = chainings.indexOf(node.$meta);
        if (i > 0) {
            const previous = chainings[i - 1].element();
            if (!previous) return;
            if (!feature.featuredBy.every((t) => previous.conforms(t))) {
                accept(
                    "error",
                    "Invalid feature chaining, chaining feature featuring types do not conform with the previous chaining feature featuring types",
                    { node }
                );
            }
        }
    }

    @validateKerML(ast.FeatureReferenceExpression)
    /* istanbul ignore next (grammar doesn't allow anything other than feature to be used) */
    validateFeatureReferenceExpressionTarget(
        node: ast.FeatureReferenceExpression,
        accept: ValidationAcceptor
    ): void {
        const target = node.expression.$meta.element();
        if (target && !target.is(ast.Feature))
            accept("error", "Invalid feature reference expression, must refer to a valid feature", {
                node,
                property: "expression",
            });
    }

    @validateKerML(ast.FeatureChainExpression)
    validateFeatureChainExpressionTarget(
        node: ast.FeatureChainExpression,
        accept: ValidationAcceptor
    ): void {
        const target = node.$meta.args.at(1);
        const left = node.$meta.args.at(0);
        if (!target || !left) return;
        const ns = left.is(ast.Expression) ? this.index.findType(left.returnType()) : left;
        if (!ns) return;

        if (target.featuredBy.length > 0 && !target.featuredBy.some((t) => ns.conforms(t)))
            accept("error", "Invalid feature chain expression, must refer to a valid feature", {
                node,
                property: "children",
                index: 1,
            });
    }

    @validateKerML(ast.InvocationExpression)
    validateInvocationArgs(node: ast.InvocationExpression, accept: ValidationAcceptor): void {
        const type = node.$meta.invokes() ?? this.index.findType(node.$meta.getFunction());
        if (!type) return;

        const expected = new Set(type.inputParameters());

        // nothing to check
        if (expected.size === 0) return;

        const received = node.$meta.ownedInputParameters();
        const visited = new Set<TypeMeta>();

        for (const param of received) {
            const redefinitions = param.types(ast.Redefinition).toArray() as FeatureMeta[];
            if (redefinitions.length === 0) continue;
            const redefinedParams = redefinitions.filter((t) => expected.has(t));
            if (redefinedParams.length === 0) {
                accept(
                    "error",
                    "Invalid invocation expression argument, cannot redefine an output parameter",
                    { node: param.ast() ?? node }
                );
            } else if (redefinedParams.some((f) => visited.has(f))) {
                accept(
                    "error",
                    "Invalid invocation expression argument, cannot bind to the same parameter multiple times",
                    { node: param.ast() ?? node }
                );
            }

            redefinedParams.forEach((p) => visited.add(p));
        }
    }

    @validateKerML(ast.OperatorExpression)
    validateCastExpression(node: ast.OperatorExpression, accept: ValidationAcceptor): void {
        if (node.operator !== "as") return;

        const type = node.$meta.args.at(1);
        if (!type) return;
        const left = node.$meta.args[0];
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
                { node }
            );
        }
    }

    // sysml has no multiplicity types/members outside of declaration so this
    // would always pass
    @validateKerML(ast.Type, { sysml: false })
    validateMultiplicityCount(node: ast.Type, accept: ValidationAcceptor): void {
        // even though multiplicity is a subtype of feature, it is parsed as a
        // non-feature element...
        const multiplicities = stream(node.$meta.children)
            .filter((m) => m.is(ast.OwningMembership))
            .map((m) => m.element())
            .nonNullable()
            .filter((f) => f.is(ast.Multiplicity))
            .tail(node.$meta.multiplicity ? 0 : 1);

        this.apply(multiplicities, "Invalid type, too many multiplicities", accept);
    }

    @validateKerML(ast.Relationship, { bounds: [ast.Type, ast.TypeRelationship, ast.Dependency] })
    /* istanbul ignore next (grammar doesn't allow triggering this validation) */
    validateRelationshipEnds(node: ast.Relationship, accept: ValidationAcceptor): void {
        if (!node.$meta.element() && !node.reference) {
            accept("error", "Invalid relationship, must have at least 2 related elements", {
                node,
            });
        }
    }

    @validateKerML(ast.FeatureRelationship)
    @validateKerML(ast.Inheritance)
    /* istanbul ignore next (grammar doesn't allow triggering this validation) */
    validateSpecializationEnds(
        node: ast.FeatureRelationship | ast.Inheritance,
        accept: ValidationAcceptor
    ): void {
        if (!node.$meta.element() && !node.reference && !node.targetChain) {
            accept("error", "Invalid relationship, must have at least 2 related elements", {
                node,
            });
        }
    }

    @validateKerML(ast.Connector)
    @validateKerML(ast.Association)
    validateConnectorEndCount(
        node: ast.Connector | ast.Association,
        accept: ValidationAcceptor
    ): void {
        // abstract connectors can have less than 2 ends
        if (node.$meta.isAbstract) return;

        if (node.$meta.allEnds().length < 2) {
            accept("error", `Invalid ${node.$type}, must have at least 2 related elements`, {
                node,
            });
        }
    }

    @validateKerML(ast.Connector)
    validateConnectorEnds(node: ast.Connector, accept: ValidationAcceptor): void {
        this.checkConnectorEnds(node, node, accept);
    }

    @validateKerML(ast.BindingConnector)
    validateBindingConnectorEnds(node: ast.BindingConnector, accept: ValidationAcceptor): void {
        const related = node.$meta.relatedFeatures();
        // skip invalid binding connectors
        if (related.length !== 2) return;

        if (!this.conformsSymmetrical(related[0].allTypings(), related[1].allTypings())) {
            accept(
                "warning",
                "Invalid binding connector, bound features should have conforming types",
                { node }
            );
        }
    }

    @validateKerML(ast.ItemFlow)
    validateItemFlowEnds(node: ast.ItemFlow, accept: ValidationAcceptor): void {
        node.$meta.itemFlowEnds().forEach((end) => {
            const subsettings = end.specializations(ast.Subsetting);
            if (!subsettings.some((sub) => !sub.is(ast.Redefinition))) {
                accept(
                    "error",
                    "Invalid flow end, cannot identify item flow end, use dot notation",
                    { node: end.ast() ?? node }
                );
            } else if (!subsettings.some((sub) => !sub.isImplied)) {
                const owning = end.featureMembers().find((m) => m.is(ast.OwningMembership));
                if (!owning) return;
                const feature = owning.element();
                if (!feature) return;
                if (feature.types(ast.Redefinition).head()) {
                    accept("warning", "Invalid item flow end, flow ends should use dot notation", {
                        node: end.ast() ?? node,
                    });
                }
            }
        });
    }

    @validateKerML(ast.Subsetting)
    validateSubsettingFeatureTypeConformance(
        node: ast.Subsetting,
        accept: ValidationAcceptor
    ): void {
        const meta = node.$meta;
        const subsetting = meta.source() as FeatureMeta | undefined;
        const subsetted = meta.element();
        if (!subsetting || !subsetted) return;

        // connectors have separate validation
        if (subsetting.owner()?.is(ast.Connector) || subsetted.owner()?.is(ast.Connector)) return;

        const subsettingTypes = subsetting.featuredBy;
        const subsettedTypes = subsetted.featuredBy;
        if (
            meta.is(ast.Redefinition) &&
            subsetted.parent() !== meta &&
            subsettedTypes.every((t) => subsettingTypes.includes(t)) &&
            subsettedTypes.length === subsettingTypes.length
        ) {
            if (subsettedTypes.length === 0) {
                accept(
                    "warning",
                    "Invalid redefinition, a package level feature should not be redefined",
                    { node }
                );
            } else {
                accept(
                    "warning",
                    "Invalid redefinition, owner of the redefining feature should not be the same as the owner of the redefined feature",
                    { node }
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
                { node }
            );
        }
    }

    private checkConnectorEnds(
        node: ast.Connector,
        source: ast.Type,
        accept: ValidationAcceptor
    ): void {
        const featuringTypes = node.$meta.featuredBy;

        const ends = node.$meta.connectorEnds();
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
                    node: source === node ? end.ast() ?? node : source,
                }
            );
        });
    }

    protected atMostOneFeature(
        node: ast.Namespace,
        type: SysMLType,
        accept: ValidationAcceptor
    ): void {
        this.atMostOne(
            stream(node.$meta.featureMembers())
                .map((m) => m.element())
                .nonNullable()
                .filter((f) => f.is(type)),
            accept,
            `At most one ${type} is allowed`
        );
    }

    protected atMostOneMember(
        node: ast.Membership,
        type: SysMLType,
        accept: ValidationAcceptor
    ): void {
        const owner = node.$container.$meta;
        if (!owner.is(ast.Namespace)) return;
        if (
            owner.featureMembers().reduce((count, member) => count + Number(member.is(type)), 0) > 1
        )
            accept("error", `At most one ${type} is allowed`, { node });
    }

    protected atMostOne(
        items: Iterable<Metamodel>,
        accept: ValidationAcceptor,
        message: string
    ): void {
        const matches = Array.from(items);

        if (matches.length < 2) return;
        this.apply(matches, message, accept);
    }

    protected apply(
        elements: Iterable<Metamodel>,
        message: string,
        accept: ValidationAcceptor
    ): void {
        for (const element of elements) {
            const node = element.ast();
            if (!node) return;
            accept("error", message, { node });
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
