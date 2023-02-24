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
import { ActionDefinition } from "../../generated/ast";
import { BehaviorMeta } from "../KerML/behavior";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { OccurrenceDefinitionMeta } from "./occurrence-definition";

@metamodelOf(ActionDefinition, {
    base: "Actions::Action",
})
export class ActionDefinitionMeta extends Mixin(OccurrenceDefinitionMeta, BehaviorMeta) {
    constructor(id: ElementID, parent: ModelContainer<ActionDefinition>) {
        super(id, parent);
    }

    override self(): ActionDefinition | undefined {
        return super.self() as ActionDefinition;
    }

    override parent(): ModelContainer<ActionDefinition> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface ActionDefinition {
        $meta: ActionDefinitionMeta;
    }
}
