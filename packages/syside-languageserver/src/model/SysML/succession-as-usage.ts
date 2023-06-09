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

import { stream } from "langium";
import { Mixin } from "ts-mixer";
import {
    ActionDefinition,
    ActionUsage,
    Connector,
    Feature,
    FeatureMembership,
    ItemFlow,
    SuccessionAsUsage,
    TransitionFeatureMembership,
    TransitionUsage,
    Type,
} from "../../generated/ast";
import { FeatureMembershipMeta, FeatureMeta, MembershipMeta } from "../KerML";
import { SuccessionMeta } from "../KerML/succession";
import { metamodelOf, BasicMetamodel } from "../metamodel";
import { ConnectorAsUsageMeta } from "./connector-as-usage";

@metamodelOf(SuccessionAsUsage, {
    base: "Links::links",
    binary: "Occurrences::happensBeforeLinks",
})
export class SuccessionAsUsageMeta extends Mixin(ConnectorAsUsageMeta, SuccessionMeta) {
    override ast(): SuccessionAsUsage | undefined {
        return this._ast as SuccessionAsUsage;
    }
    targetFeature(): FeatureMembershipMeta | undefined {
        const owner = this.owner();
        if (!owner?.is(Type)) return;

        const parent = this.parent();

        const features = owner.featureMembers();
        const index = features.findIndex((m) => m === parent);
        if (index >= features.length) return;
        return stream(features.slice(index + 1))
            .filter((m) => m.is(FeatureMembership))
            .head() as FeatureMembershipMeta | undefined;
    }

    private static findPreviousFeature(
        feature: FeatureMeta,
        linker?: (model: BasicMetamodel) => void
    ): MembershipMeta<FeatureMeta> | undefined {
        const owner = feature.owner();
        if (!owner?.is(Type)) return;

        const parent = feature.parent();
        const features = owner.featureMembers();
        let index = features.findIndex((m) => m === parent);
        while (--index >= 0) {
            const membership = features[index];
            if (membership.is(TransitionFeatureMembership)) continue;

            linker?.call(undefined, membership);
            const element = membership.element();
            if (!element) continue;
            if (
                !element.isParameter &&
                !element.is(TransitionUsage) &&
                (!element.is(Connector) ||
                    (!owner.isAny(ActionDefinition, ActionUsage) && element.is(ItemFlow)))
            )
                return membership;
        }

        return owner.is(Feature)
            ? SuccessionAsUsageMeta.findPreviousFeature(owner, linker)
            : undefined;
    }

    previousFeature(
        linker?: (model: BasicMetamodel) => void
    ): MembershipMeta<FeatureMeta> | undefined {
        return SuccessionAsUsageMeta.findPreviousFeature(this, linker);
    }
}

declare module "../../generated/ast" {
    interface SuccessionAsUsage {
        $meta: SuccessionAsUsageMeta;
    }
}
