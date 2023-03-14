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
    ActionDefinition,
    ActionUsage,
    StateDefinition,
    StateUsage,
    TransitionUsage,
} from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";

@metamodelOf(TransitionUsage, {
    base: "Actions::transitionActions",
    actionTransition: "Actions::Action::decisionTransitions",
    stateTransition: "States::StateAction::stateTransitions",
})
export class TransitionUsageMeta extends ActionUsageMeta {
    constructor(id: ElementID, parent: ModelContainer<TransitionUsage>) {
        super(id, parent);
    }

    override defaultSupertype(): string {
        if (this.isStateTransition()) return "stateTransition";
        if (this.isActionTransition()) return "actionTransition";
        return "base";
    }

    isActionTransition(): boolean {
        if (!this.isComposite) return false;
        const parent = this.owner();
        return parent.isAny([ActionUsage, ActionDefinition]);
    }

    isStateTransition(): boolean {
        if (!this.isComposite) return false;
        const parent = this.owner();
        return parent.isAny([StateDefinition, StateUsage]);
    }

    override ast(): TransitionUsage | undefined {
        return this._ast as TransitionUsage;
    }

    override parent(): ModelContainer<TransitionUsage> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface TransitionUsage {
        $meta: TransitionUsageMeta;
    }
}
