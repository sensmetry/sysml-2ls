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

const PACKAGE = "StringFunctions";

@functionFor(PACKAGE, "Substring")
export class SubstringFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const str = evaluator.asString(expression, 0, target);
        const lo = evaluator.asNumber(expression, 1, target);
        const hi = evaluator.asNumber(expression, 2, target);

        if (str === undefined || lo === undefined || hi === undefined) return;
        // 1-based indexing?????
        if (lo < 1 || hi > str.length || lo > hi + 1) return undefined;
        return [str.substring(lo - 1, hi)];
    }
}

@functionFor(PACKAGE, "Length")
export class StringLengthFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const str = evaluator.asString(expression, 0, target);

        if (str === undefined) return;
        return [str.length];
    }
}
