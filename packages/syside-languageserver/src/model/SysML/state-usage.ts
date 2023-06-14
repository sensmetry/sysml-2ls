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

import { AstNode, LangiumDocument } from "langium";
import { StateDefinition, StateUsage } from "../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage";

export interface StateUsageOptions extends ActionUsageOptions {
    isParallel?: boolean;
}

@metamodelOf(StateUsage, {
    base: "States::stateActions",
    substate: "States::StateAction::substates",
    exclusiveState: "States::StateAction::exclusiveStates",
    ownedAction: "Parts::Part::ownedStates",
})
export class StateUsageMeta extends ActionUsageMeta {
    isParallel = false;

    override getSubactionType(): string | undefined {
        if (this.isExclusiveState()) return "exclusiveState";
        if (this.isSubstate()) return "substate";
        return super.getSubactionType();
    }

    isExclusiveState(): boolean {
        const parent = this.owner();
        return Boolean(parent?.isAny(StateDefinition, StateUsage) && !parent.isParallel);
    }

    isSubstate(): boolean {
        return Boolean(
            this.isNonEntryExitComposite() && this.owner()?.isAny(StateDefinition, StateUsage)
        );
    }

    override ast(): StateUsage | undefined {
        return this._ast as StateUsage;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: StateUsageOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as StateUsageMeta;
        if (options) model.isParallel = Boolean(options.isParallel);
        return model;
    }
}

declare module "../../generated/ast" {
    interface StateUsage {
        $meta: StateUsageMeta;
    }
}
