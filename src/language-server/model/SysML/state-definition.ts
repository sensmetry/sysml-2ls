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

import { StateDefinition } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ActionDefinitionMeta } from "./action-definition";

@metamodelOf(StateDefinition, {
    base: "States::StateAction",
})
export class StateDefinitionMeta extends ActionDefinitionMeta {
    isParallel = false;

    constructor(id: ElementID, parent: ModelContainer<StateDefinition>) {
        super(id, parent);
    }

    override initialize(node: StateDefinition): void {
        this.isParallel = node.isParallel;
    }

    override ast(): StateDefinition | undefined {
        return this._ast as StateDefinition;
    }

    override parent(): ModelContainer<StateDefinition> {
        return this._parent;
    }

    override reset(node: StateDefinition): void {
        this.initialize(node);
    }
}

declare module "../../generated/ast" {
    interface StateDefinition {
        $meta: StateDefinitionMeta;
    }
}
