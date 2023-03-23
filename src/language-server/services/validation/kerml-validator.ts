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

import { MultiMap, Properties, ValidationAcceptor } from "langium";
import {
    Type,
    Subsetting,
    Feature,
    Relationship,
    Unioning,
    Intersecting,
    Differencing,
    isFeatureChaining,
    Connector,
    Redefinition,
    Element,
    Namespace,
    ReferenceUsage,
    OwningMembership,
} from "../../generated/ast";
import { MembershipMeta } from "../../model";
import { validateKerML } from "./kerml-validation-registry";

/**
 * Implementation of custom validations.
 */
export class KerMLValidator {
    @validateKerML(Type, false)
    checkTypeRelationships(type: Type, accept: ValidationAcceptor): void {
        const relationships: Partial<Record<string, Relationship[]>> = {};
        type.typeRelationships.reduce((map, r) => {
            (map[r.$type] ??= <Relationship[]>[]).push(r);
            return map;
        }, relationships);

        for (const type of [Unioning, Intersecting, Differencing]) {
            const array = relationships[type];
            if (array && array.length === 1) {
                accept("error", `A single ${type.toLowerCase()} relationship is not allowed`, {
                    node: array[0] as Relationship,
                });
            }
        }
    }

    @validateKerML(Subsetting)
    checkSubsettingMultiplicities(subsetting: Subsetting, accept: ValidationAcceptor): void {
        const feature = subsetting.$meta.source().ast() as Feature | undefined;
        if (!feature) return;

        if (feature.$meta.owner().is(Connector)) {
            // association features have multiplicity 1..1 implicitly,
            // multiplicity works differently
            return;
        }
        const nonunique = feature.isNonunique;
        const bounds = feature.$meta.multiplicity?.element()?.bounds;
        const end = feature.$meta.isEnd;

        const sub = subsetting.$meta.element();
        if (!sub) return;
        if (sub.owner().is(Connector)) return;
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

        if (subsetting.$meta.is(Redefinition) && !end) {
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

    @validateKerML(Feature)
    checkFeatureChainingLength(feature: Feature, accept: ValidationAcceptor): void {
        const chainings = feature.typeRelationships.filter((r) => isFeatureChaining(r));
        if (chainings.length === 1) {
            accept("error", "Feature chain must be a chain of 2 or more features", {
                node: chainings[0],
            });
        }
    }

    @validateKerML(Namespace)
    checkUniqueNames(element: Namespace, accept: ValidationAcceptor): void {
        const names = new MultiMap<string, [MembershipMeta, Properties<Element>]>();

        // for performance reasons, only check direct members
        for (const member of element.$meta.members) {
            // skip non-owning memberships that are not aliases
            if (!member.is(OwningMembership) && !member.isAlias()) continue;
            // skip over automatically named reference usages
            if (member.element()?.is(ReferenceUsage)) continue;
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
}
