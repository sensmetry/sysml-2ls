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

import { ElementMeta, InvocationExpressionMeta } from "../../KerML";
import {
    BuiltinFunction,
    ExpressionResult,
    ModelLevelExpressionEvaluator,
    functionFor,
} from "../util";

const PACKAGE = "NumericalFunctions";

@functionFor(PACKAGE, "product")
export class ProductFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (values === undefined) return;

        let result = 1;
        for (const value of values) {
            if (typeof value === "number") result *= value;
            else return;
        }

        return [result];
    }
}

@functionFor(PACKAGE, "sum")
export class SumFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (values === undefined) return;

        let result = 0;
        for (const value of values) {
            if (typeof value === "number") result += value;
            else return;
        }

        return [result];
    }
}
