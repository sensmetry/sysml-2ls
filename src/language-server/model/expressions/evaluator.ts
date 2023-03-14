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
    Type,
    TypeReference,
} from "../../generated/ast";
import { SysMLType, SysMLTypeList } from "../../services/sysml-ast-reflection";
import { KeysMatching } from "../../utils/common";
import {
    ElementMeta,
    ElementReferenceMeta,
    FeatureMeta,
    FeatureReferenceExpressionMeta,
    InvocationExpressionMeta,
    LiteralBooleanMeta,
    LiteralInfinityMeta,
    LiteralNumberMeta,
    LiteralStringMeta,
    MetadataAccessExpressionMeta,
    TypeMeta,
} from "../KerML";
import { Metamodel, Property } from "../metamodel";
import { typeIndex, TypeMap } from "../types";
import {
    builtinFunction,
    Evaluable,
    ExpressionResult,
    ModelLevelExpressionEvaluator,
} from "./util";

// import last
import "./functions";

type EvaluatorFunction<T = Metamodel> = (
    expression: T,
    target: ElementMeta
) => ExpressionResult[] | undefined;
type EvaluatorMap = {
    [K in SysMLType]?: EvaluatorFunction<Property<SysMLTypeList[K], "$meta">>;
};

const Evaluators: EvaluatorMap = {};

function evaluates<K extends SysMLType>(...type: K[]) {
    return function <T, TK extends KeysMatching<T, EvaluatorFunction<SysMLTypeList[K]["$meta"]>>>(
        _: T,
        __: TK,
        descriptor: PropertyDescriptor
    ): void {
        type.forEach((t) => (Evaluators[t] = descriptor.value));
    };
}

export class BuiltinFunctionEvaluator implements ModelLevelExpressionEvaluator {
    protected readonly evaluators: Map<string, EvaluatorFunction>;

    constructor() {
        this.evaluators = typeIndex.expandToDerivedTypes(
            Evaluators as TypeMap<SysMLType, EvaluatorFunction>
        );
    }

    evaluate(expression: Evaluable, target: ElementMeta): ExpressionResult[] | undefined {
        const evaluator = this.evaluators.get(expression.nodeType());
        return evaluator ? evaluator.call(this, expression, target) : [];
    }

    @evaluates(NullExpression)
    evaluateNull(): ExpressionResult[] {
        return [];
    }

    @evaluates(LiteralInfinity)
    evaluateInfinity(expression: LiteralInfinityMeta): [LiteralInfinityMeta] {
        return [expression];
    }

    @evaluates(LiteralBoolean, LiteralNumber, LiteralString)
    evaluateLiteral(
        expression: LiteralNumberMeta | LiteralBooleanMeta | LiteralStringMeta
    ): [number | boolean | string] {
        return [expression.literal];
    }

    evaluateArgument(
        expression: InvocationExpressionMeta,
        index: number,
        target: ElementMeta
    ): ExpressionResult[] | undefined {
        const arg = expression.args.at(index);
        if (!arg) return undefined;
        if (arg.value) {
            const expr = arg.value.element();
            return expr ? this.evaluate(expr, target) : undefined;
        }
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

    @evaluates(InvocationExpression)
    evaluateInvocation(
        expression: InvocationExpressionMeta,
        target: ElementMeta
    ): ExpressionResult[] | undefined {
        const fn = expression.getFunction();
        if (!fn) return;
        const builtin = builtinFunction(fn);
        if (!builtin) return;
        return builtin.call(expression, target, this);
    }

    @evaluates(FeatureReferenceExpression)
    evaluateFeatureReference(
        expression: FeatureReferenceExpressionMeta,
        target: ElementMeta
    ): ExpressionResult[] | undefined {
        const referenced = expression.expression?.element();
        if (!referenced) return undefined;
        const type = target.is(Type) ? target : undefined;
        if (referenced.is(FeatureReference)) {
            const feature = referenced.to.target;
            return type && feature ? this.evaluateFeature(feature, type) : undefined;
        }
        if (referenced.is(TypeReference)) return this.evaluateReference(referenced);
        if (referenced.is(InlineExpression)) return this.evaluate(referenced, target);
        return type ? this.evaluateFeature(referenced, type) : undefined;
    }

    @evaluates(MetadataAccessExpression)
    evaluateMetadataAccess(
        expression: MetadataAccessExpressionMeta,
        target: ElementMeta
    ): ExpressionResult[] | undefined {
        const referenced = expression.reference;
        if (!referenced) return;

        const features = [...referenced.allMetadata()];
        if (referenced.metaclass) features.push(referenced.metaclass);

        return features;
    }

    protected evaluateFeature(
        feature: FeatureMeta,
        type: TypeMeta
    ): ExpressionResult[] | undefined {
        if (
            feature
                .allTypes(undefined, true)
                .some((s) => s.qualifiedName === "Base::Anything::self")
        ) {
            // TODO: pilot wraps type through feature typing if it is not a
            // feature
            return [type];
        }
        // TODO: implement feature chains

        const value = feature.value?.element();
        if (value) {
            return this.evaluate(value, type);
        }

        return [feature];
    }

    @evaluates(ElementReference)
    evaluateReference(ref: ElementReferenceMeta): ElementMeta[] | undefined {
        const target = ref.to.target;
        if (!target) return undefined;
        return [target];
    }
}
