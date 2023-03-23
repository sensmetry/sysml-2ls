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
    Expression,
    InlineExpression,
    LiteralExpression,
    MetadataFeature,
    SysMLFunction,
    Type,
} from "../../generated/ast";
import * as meta from "../KerML";
import { ElementMeta, FeatureMeta, TypeMeta } from "../KerML";
import { BasicMetamodel, isMetamodel } from "../metamodel";
import { concatNames } from "../naming";
import { RangeGenerator } from "./range";

// TODO: we may need to add a range generator type as well for extent
// expressions, generating a large extent upfront may crash the server otherwise
export type ExpressionResultValue = BasicMetamodel | number | boolean | string;
export type ExpressionResult = ExpressionResultValue[] | RangeGenerator;
export type ExpressionLike = meta.InvocationExpressionMeta["args"][0];
export type Evaluable = meta.ExpressionMeta | meta.ElementMeta;

export abstract class BuiltinFunction {
    get isModelLevelEvaluable(): boolean {
        return true;
    }

    /**
     * Try evaluate the {@link expression}
     * @param expression invocation expression matching this builtin function
     * @param target evaluation context
     * @param evaluator evaluator instance
     */
    abstract call(
        expression: meta.InvocationExpressionMeta,
        target: meta.ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult;
}

export interface ModelLevelExpressionEvaluator {
    /**
     * Try evaluate the {@link expression}
     * @param expression Expression to evaluate
     * @param target evaluation context
     */
    evaluate(expression: Evaluable, target: meta.ElementMeta): ExpressionResult;

    /**
     * Try evaluating a chain of features
     * @param features
     * @param type evaluation context
     */
    evaluateFeatureChain(features: FeatureMeta[], type: TypeMeta): ExpressionResult;

    /**
     * Find library type by its fully qualified name
     * @param qualifiedName fully qualified name (`::` scope separators)
     * @param context Optional context to look for type in, if not provided
     * global index is used
     */
    libraryType(qualifiedName: string, context?: ElementMeta): TypeMeta | undefined;

    /**
     * Try evaluate the {@link expression} argument at {@link index}, i.e.
     * `expression.args[index]`
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     */
    evaluateArgument(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): ExpressionResult;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a
     * boolean
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     */
    asBoolean(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): boolean;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a string
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     */
    asString(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): string;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a number
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     */
    asNumber(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): number;

    /**
     * Try evaluate the {@link expression} argument at {@link index} as a single
     * argument
     * @param expression invocation expression that owns arguments
     * @param index argument index
     * @param target evaluation context
     */
    asArgument(
        expression: meta.InvocationExpressionMeta,
        index: number,
        target: meta.ElementMeta
    ): ExpressionResultValue | null;

    /**
     * Try compare two expression results {@link left} and {@link right}
     * @return if {@link left} and {@link right} can be compared, true if they
     * are equal and false otherwise
     */
    equal(left?: ExpressionResultValue | null, right?: ExpressionResultValue | null): boolean;
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
    if (arg?.is(Type)) {
        return arg.types().head();
    }

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
export function resultType(value: number): "ScalarValues::Integer" | "ScalarValues::Rational";
export function resultType(value: boolean): "ScalarValues::Boolean";
export function resultType(value: string): "ScalarValues::String";
export function resultType(value: ExpressionResultValue): meta.TypeMeta | string | undefined;
export function resultType(value: ExpressionResultValue): meta.TypeMeta | string | undefined {
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
export function typeFor(result: ExpressionResult): (meta.TypeMeta | string)[] | undefined {
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
    if (arg.value) return arg.value.element()?.returnType();
    if (arg.isAny([Expression, SysMLFunction])) return arg.returnType();
    return arg;
}

/**
 * Expand the range generator to a full array or pass through
 * @param values
 * @returns
 */
export function normalize(values: ExpressionResult): ExpressionResultValue[] {
    if (values instanceof RangeGenerator) {
        // basic sanity check
        if (values.length > 1e9) throw new Error(`Range too large: ${values.length}`);
        return values.toArray();
    }

    return values;
}
