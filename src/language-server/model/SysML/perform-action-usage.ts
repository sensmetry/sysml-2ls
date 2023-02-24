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
import { PerformActionUsage } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";
import { EventOccurrenceUsageMeta } from "./event-occurrence-usage";

@metamodelOf(PerformActionUsage, {
    performedAction: "Parts::Part::performedActions",
})
export class PerformActionUsageMeta extends Mixin(ActionUsageMeta, EventOccurrenceUsageMeta) {
    constructor(id: ElementID, parent: ModelContainer<PerformActionUsage>) {
        super(id, parent);
    }

    override initialize(node: PerformActionUsage): void {
        if (!this.name && node.references.length > 0) {
            const newName = node.references[0].chain.at(-1)?.$refText;
            if (newName) this.setName(newName);
        }
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isPerformedAction()) supertypes.push("performedAction");

        return supertypes;
    }

    override self(): PerformActionUsage | undefined {
        return super.self() as PerformActionUsage;
    }

    override parent(): ModelContainer<PerformActionUsage> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface PerformActionUsage {
        $meta: PerformActionUsageMeta;
    }
}
