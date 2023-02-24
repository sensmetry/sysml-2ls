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
import {
    ActionDefinition,
    ActionUsage,
    Feature,
    PartDefinition,
    PartUsage,
} from "../../generated/ast";
import { StepMeta } from "../KerML/step";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { OccurrenceUsageMeta } from "./occurrence-usage";
import { StateSubactionKind, getStateSubactionKind } from "../enums";

@metamodelOf(ActionUsage, {
    base: "Actions::actions",
    subaction: "Actions::Action::subactions",
    ownedAction: "Parts::Part::ownedActions",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
})
export class ActionUsageMeta extends Mixin(OccurrenceUsageMeta, StepMeta) {
    stateSubactionKind: StateSubactionKind = "none";

    constructor(id: ElementID, parent: ModelContainer<ActionUsage>) {
        super(id, parent);
    }

    override initialize(node: ActionUsage): void {
        this.stateSubactionKind = getStateSubactionKind(node);
    }

    override self(): ActionUsage | undefined {
        return super.self() as ActionUsage;
    }

    override parent(): ModelContainer<ActionUsage> {
        return this._parent;
    }

    override defaultSupertype(): string {
        return "base";
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        const subactionType = this.getSubactionType();
        if (subactionType) supertypes.push(subactionType);
        if (this.isOwnedPerformance()) supertypes.push("ownedPerformance");
        else if (this.isEnclosedPerformance()) supertypes.push("enclosedPerformance");
        return supertypes;
    }

    getSubactionType(): string | undefined {
        return this.isSubaction() ? "subaction" : this.isOwnedAction() ? "ownedAction" : undefined;
    }

    isSubaction(): boolean {
        const parent = this.parent();
        return (
            parent.is(Feature) &&
            parent.isComposite &&
            parent.isAny([ActionUsage, ActionDefinition])
        );
    }

    isOwnedAction(): boolean {
        const parent = this.parent();
        return (
            parent.is(Feature) && parent.isComposite && parent.isAny([PartUsage, PartDefinition])
        );
    }

    protected override isSuboccurrence(): boolean {
        return super.isSuboccurrence() && !this.isSubaction();
    }

    isPerformedAction(): boolean {
        const parent = this.parent();
        return parent.isAny([PartUsage, PartDefinition]);
    }
}

declare module "../../generated/ast" {
    interface ActionUsage {
        $meta: ActionUsageMeta;
    }
}
