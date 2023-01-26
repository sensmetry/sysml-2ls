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

import { Element, InvocationExpression } from "../../../generated/ast";
import {
    BuiltinFunction,
    ExpressionResult,
    ModelLevelExpressionEvaluator,
    functionFor,
} from "../util";

const PACKAGE = "SequenceFunctions";

@functionFor(PACKAGE, "includes")
export class IncludesFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpression,
        target: Element,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const values = evaluator.evaluateArgument(expression, 0, target);
        const value = evaluator.asArgument(expression, 1, target);
        if (values === undefined || value === undefined) return;
        return [values.some((v) => evaluator.equal(v, value))];
    }
}

@functionFor(PACKAGE, "isEmpty")
export class IsEmptyFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpression,
        target: Element,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (values === undefined) return;
        return [values.length === 0];
    }
}

@functionFor(PACKAGE, "notEmpty")
export class NotEmptyFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpression,
        target: Element,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (values === undefined) return;
        return [values.length !== 0];
    }
}

@functionFor(PACKAGE, "size")
export class SizeFunction extends BuiltinFunction {
    override call(
        expression: InvocationExpression,
        target: Element,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (values === undefined) return;
        return [values.length];
    }
}
