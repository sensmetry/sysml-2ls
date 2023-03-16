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

/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ElementMeta, OperatorExpressionMeta } from "../..";
import {
    BuiltinFunction,
    ModelLevelExpressionEvaluator,
    ExpressionResult,
    functionFor,
} from "../util";

const PACKAGE = "DataFunctions";

abstract class ArithmeticFunction extends BuiltinFunction {
    protected unaryNumber(x: number): ExpressionResult {
        throw new Error("Cannot evaluate unary number");
    }
    protected binaryNumber(x: number, y: number): ExpressionResult {
        throw new Error("Cannot evaluate binary numbers");
    }
    protected binaryString(x: string, y: string): ExpressionResult {
        throw new Error("Cannot evaluate binary strings");
    }

    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] {
        const x = evaluator.asArgument(expression, 0, target);

        if (expression.args.length === 1) {
            if (typeof x === "number") return [this.unaryNumber(x)];
            throw new Error("Expected a number argument");
        }

        const y = evaluator.asArgument(expression, 1, target);
        if (typeof x === "number" && typeof y === "number") return [this.binaryNumber(x, y)];
        if (typeof x === "string" && typeof y === "string") return [this.binaryString(x, y)];
        throw new Error("Mismatched argument types");
    }
}

@functionFor(PACKAGE, "'/'")
export class DivideFunction extends ArithmeticFunction {
    protected override binaryNumber(x: number, y: number): ExpressionResult {
        if (y === 0) throw new Error("Cannot divide by 0");
        return x / y;
    }
}

@functionFor(PACKAGE, "'%'")
export class RemainderFunction extends ArithmeticFunction {
    protected override binaryNumber(x: number, y: number): ExpressionResult {
        if (y === 0) throw new Error("Cannot use modulo operation on 0");
        return x % y;
    }
}

@functionFor(PACKAGE, "'*'")
export class ProdFunction extends ArithmeticFunction {
    protected override binaryNumber(x: number, y: number): ExpressionResult {
        return x * y;
    }
}

@functionFor(PACKAGE, "'>'")
export class GreaterThanFunction extends ArithmeticFunction {
    protected override binaryNumber(x: number, y: number): ExpressionResult {
        return x > y;
    }

    protected override binaryString(x: string, y: string): ExpressionResult {
        return x.localeCompare(y) > 0;
    }
}

@functionFor(PACKAGE, "'>='")
export class GreaterEqualFunction extends ArithmeticFunction {
    protected override binaryNumber(x: number, y: number): ExpressionResult {
        return x >= y;
    }

    protected override binaryString(x: string, y: string): ExpressionResult {
        return x.localeCompare(y) >= 0;
    }
}

@functionFor(PACKAGE, "'<'")
export class LessThanFunction extends ArithmeticFunction {
    protected override binaryNumber(x: number, y: number): ExpressionResult {
        return x < y;
    }

    protected override binaryString(x: string, y: string): ExpressionResult {
        return x.localeCompare(y) < 0;
    }
}

@functionFor(PACKAGE, "'<='")
export class LessEqualFunction extends ArithmeticFunction {
    protected override binaryNumber(x: number, y: number): ExpressionResult {
        return x <= y;
    }

    protected override binaryString(x: string, y: string): ExpressionResult {
        return x.localeCompare(y) <= 0;
    }
}

@functionFor(PACKAGE, "'-'")
export class SubtractionFunction extends ArithmeticFunction {
    protected override unaryNumber(x: number): ExpressionResult {
        return -x;
    }

    protected override binaryNumber(x: number, y: number): ExpressionResult {
        return x - y;
    }
}

@functionFor(PACKAGE, "'+'")
export class AdditionFunction extends ArithmeticFunction {
    protected override unaryNumber(x: number): ExpressionResult {
        return x;
    }

    protected override binaryNumber(x: number, y: number): ExpressionResult {
        return x + y;
    }

    protected override binaryString(x: string, y: string): ExpressionResult {
        return x.concat(y);
    }
}

@functionFor(PACKAGE, ["'**'", "'^'"])
export class ExponentiationFunction extends ArithmeticFunction {
    protected override binaryNumber(x: number, y: number): ExpressionResult {
        return Math.pow(x, y);
    }
}
