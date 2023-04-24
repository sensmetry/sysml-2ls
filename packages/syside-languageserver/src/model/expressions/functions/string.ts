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
    ModelLevelExpressionEvaluator,
    functionFor,
    ExpressionResult,
} from "../util";

const PACKAGE = "StringFunctions";

@functionFor(PACKAGE, "Substring")
export class SubstringFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const str = evaluator.asString(expression, 0, target);
        const lo = evaluator.asNumber(expression, 1, target);
        const hi = evaluator.asNumber(expression, 2, target);

        // 1-based indexing?????
        if (lo < 1) throw new Error(`Start ${lo} is out bounds`);
        if (hi > str.length)
            throw new Error(`End ${hi} is out bounds for string of size ${str.length}`);
        if (lo > hi + 1) throw new Error("Start is beyond end");
        return [str.substring(lo - 1, hi)];
    }
}

@functionFor(PACKAGE, "Length")
export class StringLengthFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const str = evaluator.asString(expression, 0, target);
        return [str.length];
    }
}
