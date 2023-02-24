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

import { ElementMeta, OperatorExpressionMeta } from "../../KerML";
import {
    BuiltinFunction,
    ModelLevelExpressionEvaluator,
    ExpressionResult,
    functionFor,
} from "../util";

const PACKAGE = "ControlFunctions";

abstract class ConditionalLogicalFunction extends BuiltinFunction {
    protected abstract test(value: boolean | undefined): boolean;
    protected abstract result(): boolean;

    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const first = evaluator.asBoolean(expression, 0, target);
        if (this.test(first)) return [this.result()];
        const second = evaluator.asBoolean(expression, 1, target);
        return second === undefined ? undefined : [second];
    }
}

@functionFor(PACKAGE, "'and'")
export class ConditionalAndFunction extends ConditionalLogicalFunction {
    protected override test(value: boolean | undefined): boolean {
        return value !== true;
    }

    protected override result(): boolean {
        return false;
    }
}

@functionFor(PACKAGE, "'implies'")
export class ConditionalImpliesFunction extends ConditionalLogicalFunction {
    protected override test(value: boolean | undefined): boolean {
        return value !== true;
    }

    protected override result(): boolean {
        return true;
    }
}

@functionFor(PACKAGE, "'or'")
export class ConditionalOrFunction extends ConditionalLogicalFunction {
    protected override test(value: boolean | undefined): boolean {
        return value === true;
    }

    protected override result(): boolean {
        return true;
    }
}

@functionFor(PACKAGE, "'if'")
export class ConditionalFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const test = evaluator.asBoolean(expression, 0, target);
        if (test === undefined) return undefined;
        return evaluator.evaluateArgument(expression, test ? 1 : 2, target);
    }
}

// @functionFor(PACKAGE, "'.'")
// export class DotFunction extends BuiltinFunction {
//     override call(expression: OperatorExpression, target: Element, evaluator: ModelLevelExpressionEvaluator): ResultType[] {
//         const values = evaluator.evaluate(expression.left, target);
//         if (!values) return [expression];

//     }
// }

@functionFor(PACKAGE, "'??'")
export class NullCoalescingFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (values !== undefined && values.length === 0)
            return evaluator.evaluateArgument(expression, 1, target);
        return values;
    }
}
