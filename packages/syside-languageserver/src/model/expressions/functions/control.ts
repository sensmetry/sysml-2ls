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

import { Feature, Type } from "../../../generated/ast";
import { ElementMeta, FeatureMeta, OperatorExpressionMeta } from "../../KerML";
import { RangeGenerator } from "../range";
import {
    BuiltinFunction,
    ModelLevelExpressionEvaluator,
    ExpressionResult,
    functionFor,
    normalize,
} from "../util";

const PACKAGE = "ControlFunctions";

abstract class ConditionalLogicalFunction extends BuiltinFunction {
    protected abstract test(value: boolean): boolean;
    protected abstract result(): boolean;

    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const first = evaluator.asBoolean(expression, 0, target);
        if (this.test(first)) return [this.result()];
        const second = evaluator.asBoolean(expression, 1, target);
        return [second];
    }
}

@functionFor(PACKAGE, "'and'")
export class ConditionalAndFunction extends ConditionalLogicalFunction {
    protected override test(value: boolean): boolean {
        return !value;
    }

    protected override result(): boolean {
        return false;
    }
}

@functionFor(PACKAGE, "'implies'")
export class ConditionalImpliesFunction extends ConditionalLogicalFunction {
    protected override test(value: boolean): boolean {
        return !value;
    }

    protected override result(): boolean {
        return true;
    }
}

@functionFor(PACKAGE, "'or'")
export class ConditionalOrFunction extends ConditionalLogicalFunction {
    protected override test(value: boolean): boolean {
        return value;
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
    ): ExpressionResult {
        const test = evaluator.asBoolean(expression, 0, target);
        return evaluator.evaluateArgument(expression, test ? 1 : 2, target);
    }
}

@functionFor(PACKAGE, "'.'")
export class DotFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const values = evaluator.evaluateArgument(expression, 0, target);
        const targetFeature = expression.args.at(1);
        if (!targetFeature) throw new Error("Missing target feature");

        // nothing to evaluate, everything is a number
        if (values instanceof RangeGenerator) return [];

        if (!target.is(Type)) throw new Error("Cannot evaluate feature chain for non-type targets");
        return (
            values.filter(
                (value) => typeof value === "object" && value.is(Feature)
            ) as FeatureMeta[]
        ).flatMap((value) => {
            const chaining = [value];
            if (targetFeature.chainingFeatures.length > 0)
                chaining.push(...targetFeature.chainingFeatures);
            else chaining.push(targetFeature);
            return normalize(evaluator.evaluateFeatureChain(chaining, target));
        });
    }
}

@functionFor(PACKAGE, "'??'")
export class NullCoalescingFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (values.length === 0) return evaluator.evaluateArgument(expression, 1, target);
        return values;
    }
}
