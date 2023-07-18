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

import { Type } from "langium/lib/grammar/generated/ast";
import { Feature } from "../../../generated/ast";
import { ElementMeta, FeatureMeta, OPERATORS, OperatorExpressionMeta, TypeMeta } from "../../KerML";
import { RangeGenerator } from "../range";
import {
    BuiltinFunction,
    ModelLevelExpressionEvaluator,
    ExpressionResult,
    functionFor,
    hasType,
    isType,
    typeArgument,
    resultType,
    normalize,
} from "../util";

const PACKAGE = "BaseFunctions";

function getTypeArgument(expression: OperatorExpressionMeta): TypeMeta {
    const type = typeArgument(expression);
    if (!type) throw new Error("Error computing type argument");
    return type;
}

@functionFor(PACKAGE, [OPERATORS.AS, OPERATORS.META])
export class AsFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const type = getTypeArgument(expression);
        const values = evaluator.evaluateArgument(expression, 0, target);
        if (values instanceof RangeGenerator) {
            if (type.conforms(resultType(0))) return values;
            return [];
        }
        return values.filter((v) => isType(v, type));
    }
}

@functionFor(PACKAGE, [OPERATORS.AT, OPERATORS.AT_AT])
export class AtFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const type = getTypeArgument(expression);
        const values = evaluator.evaluateArgument(expression, 0, target);
        return [values.some((v) => isType(v, type))];
    }
}

@functionFor(PACKAGE, [OPERATORS.EQUALS, OPERATORS.SAME])
export class EqualsFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const x = evaluator.asArgument(expression, 0, target);
        const y = evaluator.asArgument(expression, 1, target);

        const result = evaluator.equal(x, y);
        return [result];
    }
}

@functionFor(PACKAGE, OPERATORS.HAS_TYPE)
export class HasTypeFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const type = getTypeArgument(expression);
        const values = evaluator.evaluateArgument(expression, 0, target);
        return [values.some((v) => hasType(v, type))];
    }
}

@functionFor(PACKAGE, OPERATORS.INDEX)
export class IndexFunction extends BuiltinFunction {
    protected isCollection(values: ExpressionResult, name: string): boolean {
        return (
            !(values instanceof RangeGenerator) &&
            values.length === 1 &&
            typeof values[0] === "object" &&
            values[0].is(Type) &&
            values[0].conforms(name)
        );
    }

    /**
     * Index any array
     */
    protected indexSequence(items: ExpressionResult, index: number): ExpressionResult {
        const value = items.at(index - 1);
        if (value === undefined)
            throw new Error(`Index ${index} out of bounds for sequence of size ${items.length}`);
        return [value];
    }

    /**
     * Index `Collections::OrderedCollection`
     * @param collection `Collections::OrderedCollection`
     * @param index
     * @param evaluator
     * @returns
     */
    protected indexCollection(
        collection: FeatureMeta,
        index: number,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const elementsFeature = evaluator.libraryType(
            "Collections::Collection::elements",
            collection
        );
        if (!elementsFeature?.is(Feature))
            throw new Error("Feature 'Collections::Collection::elements' not found");
        const elements = evaluator.evaluateFeatureChain([collection, elementsFeature], collection);
        return this.indexSequence(elements, index);
    }

    /**
     * Index multi-dimensional array `Collections::Array`
     * @param array `Collections::Array`
     * @param indices
     * @param evaluator
     * @returns
     */
    protected indexArray(
        array: FeatureMeta,
        indices: ExpressionResult,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const dimensionsFeature = evaluator.libraryType("Collections::Array::dimensions", array);
        if (!dimensionsFeature?.is(Feature))
            throw new Error("Feature 'Collections::Array::dimensions' not found");
        const dimensions = evaluator.evaluateFeatureChain([array, dimensionsFeature], array);
        if (dimensions.length !== indices.length)
            throw new Error(
                `Array and index dimensions do not match: ${dimensions.length} != ${indices.length}`
            );
        if (dimensions.length === 0) return this.indexCollection(array, 1, evaluator);

        let index = 1;
        for (let i = 0; i < dimensions.length; ++i) {
            const dim = dimensions.at(i);
            const offset = indices.at(i);

            if (typeof dim !== "number") throw new Error(`Dimension at index ${i} is not a number`);
            if (typeof offset !== "number") throw new Error(`Index at index ${i} is not a number`);
            if (offset > dim)
                throw new Error(`Index at dimension ${i} is out of bounds (${offset} > ${dim})`);
            index = dim * (index - 1) + offset;
        }

        return this.indexCollection(array, index, evaluator);
    }

    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const values = evaluator.evaluateArgument(expression, 0, target);
        const indices = evaluator.evaluateArgument(expression, 1, target);

        if (this.isCollection(values, "Collections::Array")) {
            return this.indexArray(values.at(0) as FeatureMeta, indices, evaluator);
        }

        if (indices.length === 1) {
            const index = indices.at(0);
            if (typeof index !== "number") throw new Error("Index is not a number");
            if (this.isCollection(values, "Collections::OrderedCollection")) {
                return this.indexCollection(values.at(0) as FeatureMeta, index, evaluator);
            }
            return this.indexSequence(values, index);
        }

        throw new Error("Cannot use multi-dimensional index on a one-dimensional sequence");
    }
}

@functionFor(PACKAGE, OPERATORS.IS_TYPE)
export class IsTypeFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const type = getTypeArgument(expression);
        const values = evaluator.evaluateArgument(expression, 0, target);
        return [values.every((v) => isType(v, type))];
    }
}

@functionFor(PACKAGE, OPERATORS.COMMA)
export class ListConcatFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const values = normalize(evaluator.evaluateArgument(expression, 0, target));
        const extra = normalize(evaluator.evaluateArgument(expression, 1, target));
        return values.concat(...extra);
    }
}

@functionFor(PACKAGE, [OPERATORS.NOT_EQUALS, OPERATORS.NOT_SAME])
export class NotEqualsFunction extends BuiltinFunction {
    override call(
        expression: OperatorExpressionMeta,
        target: ElementMeta,
        evaluator: ModelLevelExpressionEvaluator
    ): ExpressionResult {
        const x = evaluator.asArgument(expression, 0, target);
        const y = evaluator.asArgument(expression, 1, target);

        const result = evaluator.equal(x, y);
        return [!result];
    }
}
