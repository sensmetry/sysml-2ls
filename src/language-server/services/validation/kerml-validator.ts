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

import { stream, ValidationAcceptor } from "langium";
import {
    Type,
    isAssociation,
    Subsetting,
    Feature,
    Relationship,
    Unioning,
    Intersecting,
    Differencing,
    isSubsetting,
    isFeatureChaining,
} from "../../generated/ast";
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

    protected validateSubsettingMultiplicities(
        feature: Feature,
        subsetted: Iterable<Feature>,
        accept: ValidationAcceptor
    ): void {
        return;

        // TODO: need to also skip checks for unity multiplications, blocked by
        // expression evaluation
        if (isAssociation(feature.$container)) {
            // association features have multiplicity 1..1 implicitly,
            // multiplicity works differently
            return;
        }
        const ordered = feature.isOrdered;
        const nonunique = feature.isNonunique;

        for (const sub of subsetted) {
            if (sub.isOrdered && !ordered) {
                accept(
                    "error",
                    `Subsetting feature must be ordered as subsetted feature ${sub.$meta.qualifiedName} is ordered`,
                    { node: feature }
                );
            }
            if (!sub.isNonunique && nonunique) {
                accept(
                    "error",
                    `Subsetting feature must be unique as subsetted feature ${sub.$meta.qualifiedName} is unique`,
                    { node: feature }
                );
            }

            // TODO: `feature` multiplicity bounds both should be less or equal
            // to the `feature.subsets` multiplicity bounds TODO: blocked by
            // expression evaluation
        }
    }

    @validateKerML(Feature)
    checkSubsettedMultiplicities(feature: Feature, accept: ValidationAcceptor): void {
        this.validateSubsettingMultiplicities(
            feature,
            stream(feature.typeRelationships)
                .filter((r) => isSubsetting(r))
                .map(
                    (subsetting) =>
                        (subsetting as Subsetting).reference?.$meta.to.target as Feature | undefined
                )
                .nonNullable(),
            accept
        );
    }

    @validateKerML(Subsetting)
    checkSubsettingMultiplicities(subsetting: Subsetting, accept: ValidationAcceptor): void {
        const feature = subsetting.source?.$meta.to.target?.ast() ?? subsetting.$container;
        const subsetted = subsetting.reference?.$meta.to.target?.ast();
        if (!feature || !subsetted) return;
        // Langium doesn't allow overriding interface properties but Subsetting always references features
        this.validateSubsettingMultiplicities(feature as Feature, [subsetted as Feature], accept);
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
}
