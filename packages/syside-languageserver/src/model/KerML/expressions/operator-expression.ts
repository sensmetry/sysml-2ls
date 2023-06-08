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

import { OperatorExpression } from "../../../generated/ast";
import { OPERATOR_FUNCTIONS, typeArgument, typeOf } from "../../expressions/util";
import { metamodelOf } from "../../metamodel";
import { InvocationExpressionMeta, TypeMeta } from "../_internal";

@metamodelOf(OperatorExpression)
export class OperatorExpressionMeta extends InvocationExpressionMeta {
    /**
     * The escaped operator name used in this expression
     */
    operator = "";

    override ast(): OperatorExpression | undefined {
        return this._ast as OperatorExpression;
    }

    override getFunction(): string | undefined {
        return OPERATOR_FUNCTIONS[this.operator];
    }

    override returnType(): string | TypeMeta | undefined {
        if (this.operator === "'as'" || this.operator === "'meta'") {
            // cast operators should be treated as its type arguments
            return typeArgument(this);
        }
        if (this.operator === "'#'") {
            return typeOf(this.args[0]);
        }
        if (this.operator === "'['") {
            // this is not used for indexing but setting units

            // Cannot use the argument to infer exact type so use base type, the
            // argument is a unit while the full expression should be typed by
            // quantity value. Maybe in the future we will generate mapping
            // between units and quantities to help with this
            return "Quantities::ScalarQuantityValue";
        }

        const result = this.resultParameter();
        if (result) return result.element()?.returnType();

        const returns = this.returnParameter();
        if (returns) return returns.element();

        return super.returnType();
    }
}

declare module "../../../generated/ast" {
    interface OperatorExpression {
        $meta: OperatorExpressionMeta;
    }
}
