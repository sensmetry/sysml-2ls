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

import { MultiMap, Properties, stream, ValidationAcceptor } from "langium";
import * as ast from "../../generated/ast";
import { ElementMeta, MembershipMeta } from "../../model";
import { SysMLSharedServices } from "../services";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { SysMLType } from "../sysml-ast-reflection";
import { validateKerML } from "./validation-registry";

/**
 * Implementation of custom validations.
 */
export class KerMLValidator {
    protected readonly index: SysMLIndexManager;
    constructor(services: SysMLSharedServices) {
        this.index = services.workspace.IndexManager;
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
        const feature = subsetting.$meta.source().ast() as ast.Feature | undefined;
        if (!feature) return;

        if (feature.$meta.owner().is(ast.Connector)) {
            // association features have multiplicity 1..1 implicitly,
            // multiplicity works differently
            return;
        }
        const nonunique = feature.isNonunique;
        const bounds = feature.$meta.multiplicity?.element()?.bounds;
        const end = feature.$meta.isEnd;

        const sub = subsetting.$meta.element();
        if (!sub) return;
        if (sub.owner().is(ast.Connector)) return;
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
        for (const member of element.$meta.members) {
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

    protected atMostOneFeature(
        node: ast.Namespace,
        type: SysMLType,
        accept: ValidationAcceptor
    ): void {
        this.atMostOne(
            stream(node.$meta.features)
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
        if (
            node.$container.$meta.features.reduce(
                (count, member) => count + Number(member.is(type)),
                0
            ) > 1
        )
            accept("error", `At most one ${type} is allowed`, { node });
    }

    protected atMostOne(
        items: Iterable<ElementMeta>,
        accept: ValidationAcceptor,
        message: string
    ): void {
        const matches = Array.from(items);

        if (matches.length < 2) return;
        this.apply(matches, message, accept);
    }

    protected apply(
        elements: Iterable<ElementMeta>,
        message: string,
        accept: ValidationAcceptor
    ): void {
        for (const element of elements) {
            const node = element.ast();
            if (!node) return;
            accept("error", message, { node });
        }
    }
}
