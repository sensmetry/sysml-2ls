/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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
import {
    BasicMetamodel,
    ElementIDProvider,
    GeneralType,
    MetatypeProto,
    metamodelOf,
} from "../metamodel";
import {
    ConnectorMeta,
    ConnectorOptions,
    Edge,
    ElementParts,
    EndFeatureMembershipMeta,
    FeatureMembershipMeta,
    FeatureMeta,
    ItemFeatureMeta,
    ItemFlowEndMeta,
    MembershipMeta,
    StepMeta,
    StepOptions,
} from "./_internal";
import { AstNode, LangiumDocument } from "langium";
import { enumerable } from "../../utils";

export const ImplicitItemFlows = {
    base: "Transfers::flowTransfers",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
};

export interface ItemFlowOptions extends StepOptions, ConnectorOptions {
    ends?: readonly Edge<EndFeatureMembershipMeta, ItemFlowEndMeta>[];
    item?: Edge<FeatureMembershipMeta, ItemFeatureMeta>;
}

@metamodelOf(ItemFlow, ImplicitItemFlows)
export class ItemFlowMeta extends Mixin(StepMeta, ConnectorMeta) {
    protected _item?: FeatureMembershipMeta<ItemFeatureMeta> | undefined;

    @enumerable
    get item(): FeatureMembershipMeta<ItemFeatureMeta> | undefined {
        return this._item;
    }
    set item(value: Edge<FeatureMembershipMeta, ItemFeatureMeta> | undefined) {
        this._item = this.swapEdgeOwnership(this._item, value);
    }

    override ast(): ItemFlow | undefined {
        return this._ast as ItemFlow;
    }
    override defaultGeneralTypes(): GeneralType[] {
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
        return this.ownedEnds().filter(BasicMetamodel.is(ItemFlowEnd));
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = ConnectorMeta.prototype.featureMembers.call(this);
        if (!this._item) return baseFeatures;
        return ([this._item] as MembershipMeta<FeatureMeta>[]).concat(baseFeatures);
    }

    protected override collectDeclaration(parts: ElementParts): void {
        StepMeta.prototype["collectDeclaration"].call(this, parts);
        if (this._item) {
            parts.push(["item", [this._item]]);
        }

        parts.push(["ends", this.ends]);
    }

    protected static applyItemFlowOptions(model: ItemFlowMeta, options: ItemFlowOptions): void {
        model.item = options.item;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ItemFlowOptions
    ): T["$meta"] {
        const model = ConnectorMeta.create.call(this, provider, document, options) as ItemFlowMeta;
        if (options) ItemFlowMeta.applyItemFlowOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface ItemFlow {
        $meta: ItemFlowMeta;
    }
}
