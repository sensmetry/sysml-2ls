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

import { Mixin } from "ts-mixer";
import { ItemFlow, ItemFlowEnd } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import {
    ConnectorMeta,
    ElementParts,
    FeatureMembershipMeta,
    FeatureMeta,
    ItemFeatureMeta,
    ItemFlowEndMeta,
    MembershipMeta,
    StepMeta,
} from "./_internal";

export const ImplicitItemFlows = {
    base: "Transfers::flowTransfers",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
};

@metamodelOf(ItemFlow, ImplicitItemFlows)
export class ItemFlowMeta extends Mixin(StepMeta, ConnectorMeta) {
    protected _item?: FeatureMembershipMeta<ItemFeatureMeta> | undefined;

    get item(): FeatureMembershipMeta<ItemFeatureMeta> | undefined {
        return this._item;
    }
    set item(value: FeatureMembershipMeta<ItemFeatureMeta> | undefined) {
        this._item = value;
    }

    override ast(): ItemFlow | undefined {
        return this._ast as ItemFlow;
    }
    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isStructureOwnedComposite()) supertypes.push("ownedPerformance");
        if (this.isBehaviorOwnedComposite()) supertypes.push("subperformance");
        if (this.isBehaviorOwned()) supertypes.push("enclosedPerformance");

        return supertypes;
    }

    override defaultSupertype(): string {
        return "base";
    }

    /**
     * @returns owned item flow ends of this item flow
     */
    itemFlowEnds(): ItemFlowEndMeta[] {
        return this.ownedEnds().filter((f) => f.is(ItemFlowEnd)) as ItemFlowEndMeta[];
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = ConnectorMeta.prototype.featureMembers.call(this);
        if (!this._item) return baseFeatures;
        return ([this._item] as MembershipMeta<FeatureMeta>[]).concat(baseFeatures);
    }

    override textualParts(): ElementParts {
        const parts: ElementParts = {
            prefixes: this.prefixes,
        };

        if (this._multiplicity) {
            parts.multiplicity = [this._multiplicity];
        }
        parts.heritage = this.heritage;
        parts.typeRelationships = this.typeRelationships;

        if (this.value) {
            parts.value = [this.value];
        }

        if (this._item) {
            parts.item = [this._item];
        }

        parts.ends = this.ends;
        parts.children = this.children;

        return parts;
    }
}

declare module "../../generated/ast" {
    interface ItemFlow {
        $meta: ItemFlowMeta;
    }
}
