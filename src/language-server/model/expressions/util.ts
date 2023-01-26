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
import * as ast from "../../generated/ast";
import { concatNames } from "../naming";

// TODO: we may need to add a range generator type as well for extent
// expressions, generating a large extent upfront may crash the server otherwise
export type ExpressionResult = AstNode | number | boolean | string;
export type ExpressionLike = ast.InvocationExpression["args"][0];
export type Evaluable = ast.InlineExpression | ast.ElementReference;

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
        expression: ast.InvocationExpression,
        target: ast.Element,
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
    evaluate(expression: Evaluable, target: ast.Element): ExpressionResult[] | undefined;

    /**
     * Try evaluate the {@link expression} argument at {@link index}, i.e.
     * `expression.args[index]`
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     * @return result if successful evaluation, undefined otherwise
     */
    evaluateArgument(
        expression: ast.InvocationExpression,
        index: number,
        target: ast.Element
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
        expression: ast.InvocationExpression,
        index: number,
        target: ast.Element
    ): boolean | undefined;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a string
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     * @return string if successful evaluation, undefined otherwise
     */
    asString(
        expression: ast.InvocationExpression,
        index: number,
        target: ast.Element
    ): string | undefined;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a number
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     * @return number if successful evaluation, undefined otherwise
     */
    asNumber(
        expression: ast.InvocationExpression,
        index: number,
        target: ast.Element
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
        expression: ast.InvocationExpression,
        index: number,
        target: ast.Element
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
export function builtinFunction(fn: ast.SysMLFunction | string): BuiltinFunction | undefined {
    if (typeof fn === "string") return BUILTIN_FUNCTIONS[fn];
    return BUILTIN_FUNCTIONS[fn.$meta.qualifiedName];
}

/**
 * @see {@link builtinFunction}
 * @returns true if corresponding builtin function exists and is model level
 * evaluable, false otherwise
 */
export function isModelLevelEvaluable(fn: ast.SysMLFunction): boolean {
    return builtinFunction(fn)?.isModelLevelEvaluable === true;
}

/**
 * Try get the related type argument for an operator function, e.g. `istype`,
 * `hastype`
 * @param expr owning operator expression
 * @returns type if a type parameter was found, undefined otherwise
 */
export function typeArgument(expr: ast.OperatorExpression): ast.Type | undefined {
    const arg = expr.args.at(1);
    if (ast.isTypeReference(arg)) return arg.$meta.to.target;
    if (ast.isFeatureReferenceExpression(arg)) {
        if (ast.isTypeReference(arg.expression)) return arg.expression.$meta.to.target;
        if (ast.isOperatorExpression(arg.expression)) return typeArgument(arg.expression);
    }

    return;
}

/**
 * Check if an AST node directly or indirectly specializes a type
 * @see {@link hasType}
 * @param node AST node to check
 * @param type expected type
 * @returns true if {@link node} directly or indirectly specializes {@link type}
 */
export function isType(node: unknown, type: ast.Type): boolean {
    if (ast.isType(node)) return node === type || node.$meta.allTypes().includes(type);
    if (ast.isLiteralExpression(node)) {
        return node.$meta.returnType() === type.$meta.qualifiedName;
    }
    return false;
}

/**
 * Check if an AST node directly specializes a type
 * @see {@link isType}
 * @param node AST node to check
 * @param type expected type
 * @returns true if {@link node} directly specializes {@link type}
 */
export function hasType(node: unknown, type: ast.Type): boolean {
    if (ast.isType(node)) return node === type || node.$meta.types().includes(type);
    if (ast.isLiteralExpression(node)) {
        return node.$meta.returnType() === type.$meta.qualifiedName;
    }
    return false;
}

/**
 * Try get the annotated metaclass element
 * @param element AST node
 * @returns the annotated element if {@link element} is metaclass feature
 * @see {@link isMetaclassFeature}
 */
export function metaclassReferenceOf(element: AstNode): AstNode | undefined {
    if (!ast.isMetadataFeature(element)) return;
    return element.$meta.annotates.find(
        (node) => ast.isElement(node) && node.$meta.metaclass === element
    );
}

/**
 * @returns true if {@link element} is a metadata feature to a metaclass
 */
export function isMetaclassFeature(element: AstNode): boolean {
    return metaclassReferenceOf(element) !== undefined;
}

/**
 * Try get the expression type as a standard library type
 * @param value expression result
 * @returns the return type or its fully qualified name if one was inferred,
 * undefined otherwise
 */
export function resultType(value: ExpressionResult | undefined): ast.Type | string | undefined {
    if (typeof value === "boolean") return "ScalarValues::Boolean";
    if (typeof value === "string") return "ScalarValues::String";
    if (typeof value === "number")
        return Number.isInteger(value) ? "ScalarValues::Integer" : "ScalarValues::Rational";
    if (ast.isExpression(value) || ast.isInlineExpression(value)) return value.$meta.returnType();
    if (ast.isType(value)) return value;
    return;
}

/**
 * Try get all expression types as standard library types
 * @see {@link resultType}
 * @param result expression result
 * @returns return type or its fully qualified name for each result type, or
 * undefined if any were not found
 */
export function typeFor(result: ExpressionResult[] | undefined): (ast.Type | string)[] | undefined {
    if (!result || result.length === 0) return;
    const types: (ast.Type | string)[] = [];
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
export function typeOf(arg: ast.InvocationExpression["args"][0]): ast.Type | string | undefined {
    if (ast.isTypeReference(arg)) return arg.$meta.to.target;
    if (ast.isArgument(arg)) return arg.value.$meta.returnType();
    return arg.$meta.returnType();
}
