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
import { ElementMeta, OperatorExpressionMeta } from "../../KerML";
import {
    BuiltinFunction,
    ModelLevelExpressionEvaluator,
    ExpressionResult,
    functionFor,
} from "../util";

const PACKAGE = "DataFunctions";

abstract class BooleanFunction extends BuiltinFunction {
    protected unary(x: boolean): ExpressionResult {
        throw new Error("Unary function is not implemented");
    }

    protected binary(x: boolean, y: boolean): ExpressionResult {
        throw new Error("Binary function is not implemented");
    }

    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] {
        const x = evaluator.asBoolean(expression, 0, target);
        if (expression.args.length === 1) return [this.unary(x)];
        const y = evaluator.asBoolean(expression, 1, target);
        return [this.binary(x, y)];
    }
}

@functionFor(PACKAGE, "'&'")
export class AndFunction extends BooleanFunction {
    protected override binary(x: boolean, y: boolean): ExpressionResult {
        return x && y;
    }
}

@functionFor(PACKAGE, "'|'")
export class OrFunction extends BooleanFunction {
    protected override binary(x: boolean, y: boolean): ExpressionResult {
        return x || y;
    }
}

@functionFor(PACKAGE, "'not'")
export class NotFunction extends BooleanFunction {
    protected override unary(x: boolean): ExpressionResult {
        return !x;
    }
}

@functionFor(PACKAGE, "'xor'")
export class XorFunction extends BooleanFunction {
    protected override binary(x: boolean, y: boolean): ExpressionResult {
        return x !== y;
    }
}
