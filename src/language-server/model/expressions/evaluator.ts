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
import {
    Evaluable,
    ExpressionResult,
    ModelLevelExpressionEvaluator,
    builtinFunction,
} from "./util";
import {
    Element,
    ElementReference,
    Feature,
    FeatureReferenceExpression,
    InvocationExpression,
    MetadataAccessExpression,
    Type,
    isArgument,
    isElementReference,
    isFeatureReference,
    isFeatureReferenceExpression,
    isInlineExpression,
    isInvocationExpression,
    isLiteralBoolean,
    isLiteralInfinity,
    isLiteralNumber,
    isLiteralString,
    isMetadataAccessExpression,
    isNullExpression,
    isType,
    isSelfReferenceExpression,
    isTypeReference,
} from "../../generated/ast";

// import last
import "./functions";
import { SpecializationKind } from "../enums";

export class BuiltinFunctionEvaluator implements ModelLevelExpressionEvaluator {
    evaluate(expression: Evaluable, target: Element): ExpressionResult[] | undefined {
        // TODO: lookup table
        if (isNullExpression(expression)) return [];
        if (isLiteralBoolean(expression)) return [expression.value];
        if (isLiteralNumber(expression)) return [expression.value];
        if (isLiteralString(expression)) return [expression.$meta.value];
        if (isLiteralInfinity(expression)) return [expression];
        if (isSelfReferenceExpression(expression)) return [target];

        if (isElementReference(expression)) {
            return this.evaluateReference(expression);
        }
        if (isInvocationExpression(expression)) {
            return this.evaluateInvocation(expression, target);
        }
        if (isFeatureReferenceExpression(expression)) {
            return this.evaluateFeatureReference(expression, target);
        }
        if (isMetadataAccessExpression(expression)) {
            return this.evaluateMetadataAccess(expression, target);
        }

        return [];
    }

    evaluateArgument(
        expression: InvocationExpression,
        index: number,
        target: Element
    ): ExpressionResult[] | undefined {
        const arg = expression.args.at(index);
        if (!arg) return undefined;
        if (isArgument(arg)) return this.evaluate(arg.value, target);
        return this.evaluate(arg, target);
    }

    asBoolean(
        expression: InvocationExpression,
        index: number,
        target: Element
    ): boolean | undefined {
        const value = this.asArgument(expression, index, target);
        return typeof value === "boolean" ? value : undefined;
    }

    asString(expression: InvocationExpression, index: number, target: Element): string | undefined {
        const value = this.asArgument(expression, index, target);
        return typeof value === "string" ? value : undefined;
    }

    asNumber(expression: InvocationExpression, index: number, target: Element): number | undefined {
        const value = this.asArgument(expression, index, target);
        return typeof value === "number" ? value : undefined;
    }

    asArgument(
        expression: InvocationExpression,
        index: number,
        target: Element
    ): ExpressionResult | undefined {
        const values = this.evaluateArgument(expression, index, target);
        if (values === undefined || values.length > 1) return undefined;
        return values[0];
    }

    equal(
        left?: ExpressionResult | undefined,
        right?: ExpressionResult | undefined
    ): boolean | undefined {
        if (left === undefined) return right === undefined;
        if (right === undefined) return false;
        return left === right;
    }

    protected evaluateInvocation(
        expression: InvocationExpression,
        target: Element
    ): ExpressionResult[] | undefined {
        const fn = expression.$meta.getFunction();
        if (!fn) return;
        const builtin = builtinFunction(fn);
        if (!builtin) return;
        return builtin.call(expression, target, this);
    }

    protected evaluateFeatureReference(
        expression: FeatureReferenceExpression,
        target: Element
    ): ExpressionResult[] | undefined {
        const referenced = expression.expression;
        if (!referenced) return undefined;
        const type = isType(target) ? target : undefined;
        if (isFeatureReference(referenced)) {
            const feature = referenced.$meta.to.target;
            return type && feature ? this.evaluateFeature(feature, type) : undefined;
        }
        if (isTypeReference(referenced)) return this.evaluateReference(referenced);
        if (isInlineExpression(referenced)) return this.evaluate(referenced, target);
        return type ? this.evaluateFeature(referenced, type) : undefined;
    }

    protected evaluateMetadataAccess(
        expression: MetadataAccessExpression,
        target: Element
    ): ExpressionResult[] | undefined {
        const referenced = expression.reference.$meta.to.target;
        if (!referenced) return;

        const meta = referenced.$meta;
        const features = [...meta.allMetadata()];
        if (meta.metaclass) features.push(meta.metaclass);

        return features;
    }

    protected evaluateFeature(feature: Feature, type: Type): ExpressionResult[] | undefined {
        if (
            feature.$meta
                .allTypes(SpecializationKind.None, true)
                .some((s) => s.$meta.qualifiedName === "Base::Anything::self")
        ) {
            // TODO: pilot wraps type through feature typing if it is not a
            // feature
            return [type];
        }
        // TODO: implement feature chains

        if (feature.value) {
            return this.evaluate(feature.value.expression, type);
        }

        return [feature];
    }

    protected evaluateReference(ref: ElementReference): Element[] | undefined {
        const target = ref.$meta.to.target;
        if (!target) return undefined;
        return [target];
    }
}
