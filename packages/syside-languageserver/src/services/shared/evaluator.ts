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

import { AstNode } from "langium";
import {
    BuiltinFunctionEvaluator,
    defaultEvaluators,
    ElementMeta,
    Evaluable,
    EvaluatorFunction,
    ExpressionResult,
    ExpressionResultValue,
} from "../../model";
import { SysMLSharedServices } from "../services";

export interface ExpressionError {
    /**
     * Top-level expression this error came from
     */
    expression: Evaluable;

    /**
     * Error message
     */
    message: string;

    /**
     * Evaluation stack at the point of error
     */
    stack: ElementMeta[];
}

export function isExpressionError(
    item: ExpressionResult | ExpressionResultValue | ExpressionError | null | undefined
): item is ExpressionError {
    return Boolean(typeof item === "object" && item && "message" in item);
}

/**
 *
 * @param error
 * @returns lowest-level AST node that can be used for diagnostic locations
 */
export function validationLocation(error: ExpressionError): AstNode | undefined {
    return error.stack.map((e) => e.ast()).find((node) => node) ?? error.expression.ast();
}

type CastMap = {
    boolean: boolean;
    string: string;
    // only object type in `ExpressionResultValue`
    object: ElementMeta;
};

export class SysMLExpressionEvaluator {
    protected readonly services: SysMLSharedServices;
    protected readonly evaluators: Map<string, EvaluatorFunction>;

    constructor(services: SysMLSharedServices) {
        this.services = services;
        this.evaluators = defaultEvaluators();
    }

    evaluate(expression: Evaluable, target: ElementMeta): ExpressionResult | ExpressionError {
        // we create new evaluators for each evaluation so that in case of
        // errors we can find the element that caused it
        const evaluator = new BuiltinFunctionEvaluator(this.services, this.evaluators);

        try {
            return evaluator.evaluate(expression, target);
        } catch (e) {
            return {
                expression,
                message: String(e),
                stack: [...evaluator.currentEvaluationStack],
            };
        }
    }

    /**
     *
     * @param expression element to evaluate
     * @param target expression evaluation context
     * @returns number if `expression` can be evaluated as a number
     * unambiguously, otherwise `ExpressionError`
     */
    evaluateNumber(expression: Evaluable, target: ElementMeta): number | ExpressionError {
        const result = this.evaluate(expression, target);
        if (isExpressionError(result)) return result;
        const value = result.at(0);
        if (value === undefined) {
            // 0 length, no explicit NaN in sysml so coerce null into nan
            return Number.NaN;
        }
        if (result.length > 1) {
            return {
                expression,
                message: `Too many values (${result.length}), expected 1`,
                stack: [expression],
            };
        }

        if (typeof value !== "number") {
            return {
                expression,
                message: `Value is not a number (${value})`,
                stack: [expression],
            };
        }

        return value;
    }

    protected tryCast<K extends keyof CastMap>(
        expression: Evaluable,
        target: ElementMeta,
        type: K
    ): CastMap[K] | ExpressionError {
        const result = this.evaluate(expression, target);
        if (isExpressionError(result)) return result;
        const value = result.at(0);
        if (result.length !== 1) {
            return {
                expression,
                message: `${result.length === 0 ? "Not enough" : "Too many"} values (${
                    result.length
                }), expected 1`,
                stack: [expression],
            };
        }

        if (typeof value !== type) {
            return {
                expression,
                message: `Value is not ${type === "object" ? "an" : "a"} ${type} (${value})`,
                stack: [expression],
            };
        }

        // type inference breaks here otherwise
        return value as CastMap[K];
    }

    /**
     *
     * @param expression element to evaluate
     * @param target expression evaluation context
     * @returns boolean if `expression` can be evaluated as a boolean
     * unambiguously, otherwise `ExpressionError`
     */
    evaluateBoolean(expression: Evaluable, target: ElementMeta): boolean | ExpressionError {
        return this.tryCast(expression, target, "boolean");
    }

    /**
     *
     * @param expression element to evaluate
     * @param target expression evaluation context
     * @returns string if `expression` can be evaluated as a string
     * unambiguously, otherwise `ExpressionError`
     */
    evaluateString(expression: Evaluable, target: ElementMeta): string | ExpressionError {
        return this.tryCast(expression, target, "string");
    }

    /**
     *
     * @param expression element to evaluate
     * @param target expression evaluation context
     * @returns element if `expression` can be evaluated as a single element
     * unambiguously, otherwise `ExpressionError`
     */
    evaluateElement(expression: Evaluable, target: ElementMeta): ElementMeta | ExpressionError {
        return this.tryCast(expression, target, "object");
    }
}
