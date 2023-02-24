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
    hasType,
    isType,
    typeArgument,
} from "../util";

const PACKAGE = "BaseFunctions";

@functionFor(PACKAGE, ["'as'", "'meta'"])
export class AsFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const type = typeArgument(expression);
        if (!type) return;

        const values = evaluator.evaluateArgument(expression, 0, target);
        if (!values) return;
        return values.filter((v) => isType(v, type));
    }
}

@functionFor(PACKAGE, ["'@'", "'@@'"])
export class AtFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const type = typeArgument(expression);
        if (!type) return;
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (!values) return;

        return [values.some((v) => isType(v, type))];
    }
}

@functionFor(PACKAGE, ["'=='", "'==='"])
export class EqualsFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const x = evaluator.asArgument(expression, 0, target);
        const y = evaluator.asArgument(expression, 1, target);

        const result = evaluator.equal(x, y);
        return result === undefined ? undefined : [result];
    }
}

@functionFor(PACKAGE, "'hastype'")
export class HasTypeFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const type = typeArgument(expression);
        if (!type) return;
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (!values) return;

        return [values.some((v) => hasType(v, type))];
    }
}

@functionFor(PACKAGE, "'['")
export class IndexFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const values = evaluator.evaluateArgument(expression, 0, target);
        const index = evaluator.asNumber(expression, 1, target);
        if (values === undefined || index === undefined) return;
        if (index < 1 || index > values.length) return undefined;
        return [values[index - 1]];
    }
}

@functionFor(PACKAGE, "'istype'")
export class IsTypeFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const type = typeArgument(expression);
        if (!type) return;
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (!values) return;

        return [values.every((v) => isType(v, type))];
    }
}

@functionFor(PACKAGE, "','")
export class ListConcatFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const values = evaluator.evaluateArgument(expression, 0, target);
        const extra = evaluator.evaluateArgument(expression, 1, target);
        if (values === undefined || extra === undefined) return;
        return values.concat(...extra);
    }
}

@functionFor(PACKAGE, ["'!='", "'!=='"])
export class NotEqualsFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined {
        const x = evaluator.asArgument(expression, 0, target);
        const y = evaluator.asArgument(expression, 1, target);

        const result = evaluator.equal(x, y);
        return result === undefined ? undefined : [!result];
    }
}
