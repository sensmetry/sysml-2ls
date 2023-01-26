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

import { OperatorExpression, Type } from "../../generated/ast";
import { OPERATOR_FUNCTIONS, typeArgument, typeOf } from "../expressions/util";
import { metamodelOf, ElementID } from "../metamodel";
import { InvocationExpressionMeta } from "./invocation-expression";

@metamodelOf(OperatorExpression)
export class OperatorExpressionMeta extends InvocationExpressionMeta {
    /**
     * The escaped operator name used in this expression
     */
    operator = "";

    constructor(node: OperatorExpression, id: ElementID) {
        super(node, id);
    }

    override initialize(node: OperatorExpression): void {
        if (node.operator) this.operator = `'${node.operator}'`;
    }

    override self(): OperatorExpression {
        return super.self() as OperatorExpression;
    }

    override getFunction(): string | undefined {
        return OPERATOR_FUNCTIONS[this.operator];
    }

    override returnType(): string | Type | undefined {
        if (this.operator === "'as'" || this.operator === "'meta'") {
            // cast operators should be treated as its type arguments
            return typeArgument(this.self());
        }
        if (this.operator === "'['") {
            // TODO: indexing with a feature (like SI::mm) should probably
            // return args[1]
            return typeOf(this.self().args[0]);
        }
        return super.returnType();
    }
}

declare module "../../generated/ast" {
    interface OperatorExpression {
        $meta: OperatorExpressionMeta;
    }
}
