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
import { ActionUsage, PartDefinition, PartUsage } from "../../generated/ast";
import { StepMeta } from "../KerML/step";
import { metamodelOf } from "../metamodel";
import { OccurrenceUsageMeta } from "./occurrence-usage";

@metamodelOf(ActionUsage, {
    base: "Actions::actions",
    subaction: "Actions::Action::subactions",
    ownedAction: "Parts::Part::ownedActions",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
    entry: "States::StateAction::entryAction",
    do: "States::StateAction::doAction",
    exit: "States::StateAction::exitAction",
    trigger: "Actions::TransitionAction::accepter",
    guard: "Actions::TransitionAction::guard",
    effect: "Actions::TransitionAction::effect",
})
export class ActionUsageMeta extends Mixin(StepMeta, OccurrenceUsageMeta) {
    isParallel = false;

    override ast(): ActionUsage | undefined {
        return this._ast as ActionUsage;
    }

    override defaultSupertype(): string {
        return "base";
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        const subactionType = this.getSubactionType();
        if (subactionType) supertypes.push(subactionType);
        if (this.isStructureOwnedComposite()) supertypes.push("ownedPerformance");
        else if (this.isBehaviorOwned()) supertypes.push("enclosedPerformance");
        return supertypes;
    }

    getSubactionType(): string | undefined {
        return this.isActionOwnedComposite()
            ? "subaction"
            : this.isPartOwnedComposite()
            ? "ownedAction"
            : undefined;
    }

    protected override isSuboccurrence(): boolean {
        return super.isSuboccurrence() && !this.isActionOwnedComposite();
    }

    isPerformedAction(): boolean {
        const parent = this.owner();
        return Boolean(parent?.isAny(PartUsage, PartDefinition));
    }
}

declare module "../../generated/ast" {
    interface ActionUsage {
        $meta: ActionUsageMeta;
    }
}
