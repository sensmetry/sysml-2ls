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

import { StateDefinition, StateUsage } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";

@metamodelOf(StateUsage, {
    base: "States::stateActions",
    substate: "States::StateAction::substates",
    exclusiveState: "States::StateAction::exclusiveStates",
    ownedAction: "Parts::Part::ownedStates",
})
export class StateUsageMeta extends ActionUsageMeta {
    constructor(id: ElementID, parent: ModelContainer<StateUsage>) {
        super(id, parent);
    }

    override getSubactionType(): string | undefined {
        if (this.isExclusiveState()) return "exclusiveState";
        if (this.isSubstate()) return "substate";
        return super.getSubactionType();
    }

    isExclusiveState(): boolean {
        const parent = this.owner();
        return parent.isAny([StateDefinition, StateUsage]) && !parent.isParallel;
    }

    isSubstate(): boolean {
        return this.isNonEntryExitComposite() && this.owner().isAny([StateDefinition, StateUsage]);
    }

    override ast(): StateUsage | undefined {
        return this._ast as StateUsage;
    }

    override parent(): ModelContainer<StateUsage> {
        return this._parent;
    }

    override reset(node: StateUsage): void {
        this.initialize(node);
    }
}

declare module "../../generated/ast" {
    interface StateUsage {
        $meta: StateUsageMeta;
    }
}
