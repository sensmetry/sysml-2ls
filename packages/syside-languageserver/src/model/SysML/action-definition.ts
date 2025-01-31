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
import { ActionDefinition } from "../../generated/ast";
import { BehaviorMeta, BehaviorOptions } from "../KerML/behavior";
import { metamodelOf } from "../metamodel";
import { OccurrenceDefinitionMeta, OccurrenceDefinitionOptions } from "./occurrence-definition";

export interface ActionDefinitionOptions extends BehaviorOptions, OccurrenceDefinitionOptions {}

@metamodelOf(ActionDefinition, {
    base: "Actions::Action",
})
export class ActionDefinitionMeta extends Mixin(BehaviorMeta, OccurrenceDefinitionMeta) {
    override ast(): ActionDefinition | undefined {
        return this._ast as ActionDefinition;
    }
}

declare module "../../generated/ast" {
    interface ActionDefinition {
        $meta: ActionDefinitionMeta;
    }
}
