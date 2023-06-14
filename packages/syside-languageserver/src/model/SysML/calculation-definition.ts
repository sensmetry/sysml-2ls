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
import { CalculationDefinition } from "../../generated/ast";
import { FunctionMeta, FunctionOptions } from "../KerML/function";
import { metamodelOf } from "../metamodel";
import { ActionDefinitionMeta, ActionDefinitionOptions } from "./action-definition";
import { ElementParts } from "../KerML";

export interface CalculationDefinitionOptions extends FunctionOptions, ActionDefinitionOptions {}

@metamodelOf(CalculationDefinition, {
    base: "Calculations::Calculation",
})
export class CalculationDefinitionMeta extends Mixin(FunctionMeta, ActionDefinitionMeta) {
    override ast(): CalculationDefinition | undefined {
        return this._ast as CalculationDefinition;
    }

    protected override collectDeclaration(parts: ElementParts): void {
        ActionDefinitionMeta.prototype["collectDeclaration"].call(this, parts);
        if (this._result) parts.push(["result", [this._result]]);
    }
}

declare module "../../generated/ast" {
    interface CalculationDefinition {
        $meta: CalculationDefinitionMeta;
    }
}
