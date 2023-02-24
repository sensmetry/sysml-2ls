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

// import last
import "./functions";
import { SpecializationKind } from "../enums";
import {
    ElementMeta,
    ElementReferenceMeta,
    FeatureMeta,
    FeatureReferenceExpressionMeta,
    InvocationExpressionMeta,
    MetadataAccessExpressionMeta,
    TypeMeta,
} from "../KerML";
import {
    Argument,
    ElementReference,
    FeatureReference,
    FeatureReferenceExpression,
    InlineExpression,
    InvocationExpression,
    LiteralBoolean,
    LiteralInfinity,
    LiteralNumber,
    LiteralString,
    MetadataAccessExpression,
    NullExpression,
    SelfReferenceExpression,
    Type,
    TypeReference,
} from "../../generated/ast";

export class BuiltinFunctionEvaluator implements ModelLevelExpressionEvaluator {
    evaluate(expression: Evaluable, target: ElementMeta): ExpressionResult[] | undefined {
        // TODO: lookup table
        if (expression.is(NullExpression)) return [];
        if (expression.is(LiteralBoolean)) return [expression.value];
        if (expression.is(LiteralNumber)) return [expression.value];
        if (expression.is(LiteralString)) return [expression.value];
        if (expression.is(LiteralInfinity)) return [expression];
        if (expression.is(SelfReferenceExpression)) return [target];

        if (expression.is(ElementReference)) {
            return this.evaluateReference(expression);
        }
        if (expression.is(InvocationExpression)) {
            return this.evaluateInvocation(expression, target);
        }
        if (expression.is(FeatureReferenceExpression)) {
            return this.evaluateFeatureReference(expression, target);
        }
        if (expression.is(MetadataAccessExpression)) {
            return this.evaluateMetadataAccess(expression, target);
        }

        return [];
    }

    evaluateArgument(
        expression: InvocationExpressionMeta,
        index: number,
        target: ElementMeta
    ): ExpressionResult[] | undefined {
        const arg = expression.args.at(index);
        if (!arg) return undefined;
        if (arg.is(Argument)) return arg.value ? this.evaluate(arg.value, target) : undefined;
        return this.evaluate(arg, target);
    }

    asBoolean(
        expression: InvocationExpressionMeta,
        index: number,
        target: ElementMeta
    ): boolean | undefined {
        const value = this.asArgument(expression, index, target);
        return typeof value === "boolean" ? value : undefined;
    }

    asString(
        expression: InvocationExpressionMeta,
        index: number,
        target: ElementMeta
    ): string | undefined {
        const value = this.asArgument(expression, index, target);
        return typeof value === "string" ? value : undefined;
    }

    asNumber(
        expression: InvocationExpressionMeta,
        index: number,
        target: ElementMeta
    ): number | undefined {
        const value = this.asArgument(expression, index, target);
        return typeof value === "number" ? value : undefined;
    }

    asArgument(
        expression: InvocationExpressionMeta,
        index: number,
        target: ElementMeta
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
        expression: InvocationExpressionMeta,
        target: ElementMeta
    ): ExpressionResult[] | undefined {
        const fn = expression.getFunction();
        if (!fn) return;
        const builtin = builtinFunction(fn);
        if (!builtin) return;
        return builtin.call(expression, target, this);
    }

    protected evaluateFeatureReference(
        expression: FeatureReferenceExpressionMeta,
        target: ElementMeta
    ): ExpressionResult[] | undefined {
        const referenced = expression.expression?.element;
        if (!referenced) return undefined;
        const type = target.is(Type) ? target : undefined;
        if (referenced.is(FeatureReference)) {
            const feature = referenced.to.target?.element;
            return type && feature ? this.evaluateFeature(feature, type) : undefined;
        }
        if (referenced.is(TypeReference)) return this.evaluateReference(referenced);
        if (referenced.is(InlineExpression)) return this.evaluate(referenced, target);
        return type ? this.evaluateFeature(referenced, type) : undefined;
    }

    protected evaluateMetadataAccess(
        expression: MetadataAccessExpressionMeta,
        target: ElementMeta
    ): ExpressionResult[] | undefined {
        const referenced = expression.reference;
        if (!referenced) return;

        const features = [...referenced.allMetadata().map((c) => c.element)];
        if (referenced.metaclass) features.push(referenced.metaclass);

        return features;
    }

    protected evaluateFeature(
        feature: FeatureMeta,
        type: TypeMeta
    ): ExpressionResult[] | undefined {
        if (
            feature
                .allTypes(SpecializationKind.None, true)
                .some((s) => s.qualifiedName === "Base::Anything::self")
        ) {
            // TODO: pilot wraps type through feature typing if it is not a
            // feature
            return [type];
        }
        // TODO: implement feature chains

        if (feature.value?.element) {
            return this.evaluate(feature.value.element, type);
        }

        return [feature];
    }

    protected evaluateReference(ref: ElementReferenceMeta): ElementMeta[] | undefined {
        const target = ref.to.target?.element;
        if (!target) return undefined;
        return [target];
    }
}
