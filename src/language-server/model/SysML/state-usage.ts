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

import {
    ActionUsage,
    isStateDefinition,
    isStateUsage,
    StateDefinition,
    StateUsage,
} from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";

function isState(node: unknown): node is StateUsage | StateDefinition {
    return isStateDefinition(node) || isStateUsage(node);
}

@metamodelOf(StateUsage, {
    base: "States::stateActions",
    substate: "States::StateAction::substates",
    exclusiveState: "States::StateAction::exclusiveStates",
    ownedAction: "Parts::Part::ownedStates",
})
export class StateUsageMeta extends ActionUsageMeta {
    isParallel = false;

    subactions: ActionUsage[] = [];

    constructor(node: StateUsage, id: ElementID) {
        super(node, id);
    }

    override initialize(node: StateUsage): void {
        this.isParallel = node.isParallel;
        this.subactions.push(...node.subactions);
    }

    override getSubactionType(): string | undefined {
        if (this.isExclusiveState()) return "exclusiveState";
        if (this.isSubstate()) return "substate";
        return super.getSubactionType();
    }

    isExclusiveState(): boolean {
        const parent = this.parent();
        return isState(parent) && !parent.$meta.isParallel;
    }

    isSubstate(): boolean {
        return isState(this.parent());
    }

    override self(): StateUsage {
        return super.self() as StateUsage;
    }

    override reset(): void {
        super.reset();
        this.subactions = [...this.self().subactions];
    }
}

declare module "../../generated/ast" {
    interface StateUsage {
        $meta: StateUsageMeta;
    }
}
