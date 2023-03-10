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
import { ItemFlowMeta } from "../KerML/item-flow";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";
import { ConnectionUsageMeta } from "./connection-usage";

@metamodelOf(FlowConnectionUsage, {
    base: "Connections::flowConnections",
    message: "Connections::messageConnections",
    enclosedPerformance: "Performances::Performance::enclosedTransfers",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
})
export class FlowConnectionUsageMeta extends Mixin(
    ConnectionUsageMeta,
    ActionUsageMeta,
    ItemFlowMeta
) {
    constructor(id: ElementID, parent: ModelContainer<FlowConnectionUsage>) {
        super(id, parent);
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isOwnedPerformance()) supertypes.push("ownedPerformance");
        if (this.isSubperformance()) supertypes.push("subperformance");
        if (this.isEnclosedPerformance()) supertypes.push("enclosedPerformance");

        return supertypes;
    }

    override defaultSupertype(): string {
        return !this.features.some((f) => f.element()?.isEnd) ? "message" : "base";
    }

    override ast(): FlowConnectionUsage | undefined {
        return this._ast as FlowConnectionUsage;
    }

    override parent(): ModelContainer<FlowConnectionUsage> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface FlowConnectionUsage {
        $meta: FlowConnectionUsageMeta;
    }
}
