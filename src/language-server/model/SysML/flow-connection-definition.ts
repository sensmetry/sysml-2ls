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
import { FlowConnectionDefinition } from "../../generated/ast";
import { InteractionMeta } from "../KerML/interaction";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ActionDefinitionMeta } from "./action-definition";
import { ConnectionDefinitionMeta } from "./connection-definition";

@metamodelOf(FlowConnectionDefinition, {
    binary: "Connections::MessageConnection",
})
export class FlowConnectionDefinitionMeta extends Mixin(
    ConnectionDefinitionMeta,
    ActionDefinitionMeta,
    InteractionMeta
) {
    constructor(id: ElementID, parent: ModelContainer<FlowConnectionDefinition>) {
        super(id, parent);
    }

    override ast(): FlowConnectionDefinition | undefined {
        return this._ast as FlowConnectionDefinition;
    }

    override parent(): ModelContainer<FlowConnectionDefinition> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface FlowConnectionDefinition {
        $meta: FlowConnectionDefinitionMeta;
    }
}
