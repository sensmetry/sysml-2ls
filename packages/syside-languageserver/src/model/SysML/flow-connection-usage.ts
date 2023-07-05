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
import { FlowConnectionUsage } from "../../generated/ast";
import { ItemFlowMeta, ItemFlowOptions } from "../KerML/item-flow";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage";
import { ConnectionUsageMeta, ConnectionUsageOptions } from "./connection-usage";
import { AstNode, LangiumDocument } from "langium";
import { Edge, EndFeatureMembershipMeta, ItemFlowEndMeta } from "../KerML";

export interface FlowConnectionUsageOptions
    extends ConnectionUsageOptions,
        ActionUsageOptions,
        ItemFlowOptions {
    ends?: readonly Edge<EndFeatureMembershipMeta, ItemFlowEndMeta>[];
}

@metamodelOf(FlowConnectionUsage, {
    base: "Connections::flowConnections",
    message: "Connections::messageConnections",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
    subaction: "Actions::Action::subactions",
    ownedAction: "Parts::Part::ownedActions",
})
export class FlowConnectionUsageMeta extends Mixin(
    ActionUsageMeta,
    ItemFlowMeta,
    ConnectionUsageMeta
) {
    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isPartOwnedComposite()) supertypes.push("ownedAction");
        else if (this.isStructureOwnedComposite()) supertypes.push("ownedPerformance");

        if (this.isActionOwnedComposite()) supertypes.push("subaction");
        else if (this.isBehaviorOwnedComposite()) supertypes.push("subperformance");
        else if (this.isBehaviorOwned()) supertypes.push("enclosedPerformance");

        return supertypes;
    }

    override defaultSupertype(): string {
        return !this.featureMembers().some((f) => f.element()?.isEnd) ? "message" : "base";
    }

    override ast(): FlowConnectionUsage | undefined {
        return this._ast as FlowConnectionUsage;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: FlowConnectionUsageOptions
    ): T["$meta"] {
        const model = ConnectionUsageMeta.create.call(
            this,
            provider,
            document,
            options
        ) as FlowConnectionUsageMeta;
        if (options) {
            ItemFlowMeta.applyItemFlowOptions(model, options);
        }
        return model;
    }
}

declare module "../../generated/ast" {
    interface FlowConnectionUsage {
        $meta: FlowConnectionUsageMeta;
    }
}
