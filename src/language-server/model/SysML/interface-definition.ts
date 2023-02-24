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

import { InterfaceDefinition } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ConnectionDefinitionMeta } from "./connection-definition";

@metamodelOf(InterfaceDefinition, {
    base: "Interfaces::Interface",
    binary: "Interfaces::BinaryInterface",
})
export class InterfaceDefinitionMeta extends ConnectionDefinitionMeta {
    constructor(id: ElementID, parent: ModelContainer<InterfaceDefinition>) {
        super(id, parent);
    }

    override self(): InterfaceDefinition | undefined {
        return super.self() as InterfaceDefinition;
    }

    override parent(): ModelContainer<InterfaceDefinition> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface InterfaceDefinition {
        $meta: InterfaceDefinitionMeta;
    }
}
