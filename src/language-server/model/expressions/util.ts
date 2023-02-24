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
    Argument,
    Expression,
    FeatureReferenceExpression,
    InlineExpression,
    LiteralExpression,
    MetadataFeature,
    OperatorExpression,
    Type,
} from "../../generated/ast";
import * as meta from "../KerML";
import { BasicMetamodel, isMetamodel } from "../metamodel";
import { concatNames } from "../naming";

// TODO: we may need to add a range generator type as well for extent
// expressions, generating a large extent upfront may crash the server otherwise
export type ExpressionResult = BasicMetamodel | number | boolean | string;
export type ExpressionLike = meta.InvocationExpressionMeta["args"][0];
export type Evaluable = meta.InlineExpressionMeta | meta.ElementMeta;

export abstract class BuiltinFunction {
    get isModelLevelEvaluable(): boolean {
        return true;
    }

    /**
     * Try evaluate the {@link expression}
     * @param expression invocation expression matching this builtin function
     * @param target evaluation context
     * @param evaluator evaluator instance
     * @return result if successful evaluation, undefined otherwise
     */
    abstract call(
        expression: meta.InvocationExpressionMeta,
        target: meta.ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult[] | undefined;
}

export interface ModelLevelExpressionEvaluator {
    /**
     * Try evaluate the {@link expression}
     * @param expression Expression to evaluate
     * @param target evaluation context
     * @return result if successful evaluation, undefined otherwise
     */
    evaluate(expression: Evaluable, target: meta.ElementMeta): ExpressionResult[] | undefined;

    /**
     * Try evaluate the {@link expression} argument at {@link index}, i.e.
     * `expression.args[index]`
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     * @return result if successful evaluation, undefined otherwise
     */
    evaluateArgument(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): ExpressionResult[] | undefined;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a
     * boolean
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     * @return boolean if successful evaluation, undefined otherwise
     */
    asBoolean(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): boolean | undefined;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a string
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     * @return string if successful evaluation, undefined otherwise
     */
    asString(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): string | undefined;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a number
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     * @return number if successful evaluation, undefined otherwise
     */
    asNumber(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): number | undefined;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a single
     * argument
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     * @return single result if successful evaluation, undefined otherwise
     */
    asArgument(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): ExpressionResult | undefined;

    /**
     * Try compare two expression results {@link left} and {@link right}
     * @return if {@link left} and {@link right} can be compared, true if they
     * are equal and false otherwise, otherwise undefined
     */
    equal(left?: ExpressionResult, right?: ExpressionResult): boolean | undefined;
}

export const BUILTIN_FUNCTIONS: Record<string, BuiltinFunction> = {};
export const OPERATOR_FUNCTIONS: Record<string, string> = {};

// TODO: Allow multiple packages to account for specializations
export function functionFor(
    pack: string,
    operators: string | string[]
): <T extends BuiltinFunction>(target: { new (): T }) => void {
    const functions: string[] = [];
    const add = (op: string): void => {
        const name = concatNames(pack, op);
        if (op.startsWith("'")) OPERATOR_FUNCTIONS[op] = name;
        functions.push(name);
    };

    if (typeof operators === "string") add(operators);
    else operators.forEach((op) => add(op));

    return function <T extends BuiltinFunction>(target: { new (): T }): void {
        for (const f of functions) {
            BUILTIN_FUNCTIONS[f] = new target();
        }
    };
}

/**
 * Try get a corresponding builtin function
 * @param fn Function node or fully qualified name
 * @returns the corresponding builtin function if one was registered, undefined
 * otherwise
 */
export function builtinFunction(fn: meta.FunctionMeta | string): BuiltinFunction | undefined {
    if (typeof fn === "string") return BUILTIN_FUNCTIONS[fn];
    return BUILTIN_FUNCTIONS[fn.qualifiedName];
}

/**
 * @see {@link builtinFunction}
 * @returns true if corresponding builtin function exists and is model level
 * evaluable, false otherwise
 */
export function isModelLevelEvaluable(fn: meta.FunctionMeta): boolean {
    return builtinFunction(fn)?.isModelLevelEvaluable === true;
}

/**
 * Try get the related type argument for an operator function, e.g. `istype`,
 * `hastype`
 * @param expr owning operator expression
 * @returns type if a type parameter was found, undefined otherwise
 */
export function typeArgument(expr: meta.OperatorExpressionMeta): meta.TypeMeta | undefined {
    const arg = expr.args.at(1);
    if (arg?.is(FeatureReferenceExpression)) {
        const expr = arg.expression?.element;
        if (expr?.is(Type)) return expr;
        if (expr?.is(OperatorExpression)) return typeArgument(expr);
    } else if (arg?.is(Type)) return arg;

    return;
}

/**
 * Check if an element directly or indirectly specializes a type
 * @see {@link hasType}
 * @param node element to check
 * @param type expected type
 * @returns true if {@link node} directly or indirectly specializes {@link type}
 */
export function isType(node: unknown, type: meta.TypeMeta): boolean {
    if (!isMetamodel(node)) return false;
    if (node.is(Type)) return node === type || node.allTypes().includes(type);
    if (node.is(LiteralExpression)) {
        return node.returnType() === type.qualifiedName;
    }
    return false;
}

/**
 * Check if an element directly specializes a type
 * @see {@link isType}
 * @param node element to check
 * @param type expected type
 * @returns true if {@link node} directly specializes {@link type}
 */
export function hasType(node: unknown, type: meta.TypeMeta): boolean {
    if (!isMetamodel(node)) return false;
    if (node.is(Type)) return node === type || node.types().includes(type);
    if (node.is(LiteralExpression)) {
        return node.returnType() === type.qualifiedName;
    }
    return false;
}

/**
 * Try get the annotated metaclass element
 * @param element element
 * @returns the annotated element if {@link element} is metaclass feature
 * @see {@link isMetaclassFeature}
 */
export function metaclassReferenceOf(element: meta.ElementMeta): meta.ElementMeta | undefined {
    if (!element.is(MetadataFeature)) return;
    return element.annotates.find((node) => node.metaclass === element);
}

/**
 * @returns true if {@link element} is a metadata feature to a metaclass
 */
export function isMetaclassFeature(element: meta.ElementMeta): boolean {
    return metaclassReferenceOf(element) !== undefined;
}

/**
 * Try get the expression type as a standard library type
 * @param value expression result
 * @returns the return type or its fully qualified name if one was inferred,
 * undefined otherwise
 */
export function resultType(
    value: ExpressionResult | undefined
): meta.TypeMeta | string | undefined {
    if (typeof value === "boolean") return "ScalarValues::Boolean";
    if (typeof value === "string") return "ScalarValues::String";
    if (typeof value === "number")
        return Number.isInteger(value) ? "ScalarValues::Integer" : "ScalarValues::Rational";
    if (value?.isAny([InlineExpression, Expression])) return value.returnType();
    if (value?.is(Type)) return value;
    return;
}

/**
 * Try get all expression types as standard library types
 * @see {@link resultType}
 * @param result expression result
 * @returns return type or its fully qualified name for each result type, or
 * undefined if any were not found
 */
export function typeFor(
    result: ExpressionResult[] | undefined
): (meta.TypeMeta | string)[] | undefined {
    if (!result || result.length === 0) return;
    const types: (meta.TypeMeta | string)[] = [];
    for (const value of result) {
        const type = resultType(value);
        if (type) types.push(type);
    }
    return types;
}

/**
 * Try get invocation expression argument type as a standard library type
 * @param arg argument
 * @returns argument type or its fully qualified name if one was inferred,
 * undefined otherwise
 */
export function typeOf(arg: ExpressionLike): meta.TypeMeta | string | undefined {
    if (!arg) return;
    if (arg.is(Type)) return arg;
    if (arg.is(Argument)) return arg.value?.returnType();
    return arg.returnType();
}
