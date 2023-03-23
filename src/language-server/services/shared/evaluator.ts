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

import {
    BuiltinFunctionEvaluator,
    defaultEvaluators,
    ElementMeta,
    Evaluable,
    EvaluatorFunction,
    ExpressionResult,
} from "../../model";
import { SysMLSharedServices } from "../services";

export interface ExpressionError {
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
    item: ExpressionResult | ExpressionError | null | undefined
): item is ExpressionError {
    return Boolean(item && "message" in item);
}

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
                message: String(e),
                stack: [...evaluator.currentEvaluationStack],
            };
        }
    }
}
