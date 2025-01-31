/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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
    Expression,
    Feature,
    FeatureReference,
    FeatureReferenceExpression,
    InlineExpression,
    InvocationExpression,
    LiteralBoolean,
    LiteralInfinity,
    LiteralNumber,
    LiteralString,
    MetadataAccessExpression,
    MetadataFeature,
    NullExpression,
    Redefinition,
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
    FeatureTypingMeta,
    InvocationExpressionMeta,
    LiteralBooleanMeta,
    LiteralInfinityMeta,
    LiteralNumberMeta,
    LiteralStringMeta,
    MetadataAccessExpressionMeta,
    TypeMeta,
} from "../KerML";
import { Metamodel, Property } from "../metamodel";
import {
    builtinFunction,
    Evaluable,
    ExpressionResultValue,
    ExpressionResult,
    isMetaclassFeature,
    ModelLevelExpressionEvaluator,
    normalize,
} from "./util";
import { SysMLSharedServices } from "../../services/services";
import { ModelUtil } from "../../services/shared/model-utils";
import { SysMLIndexManager } from "../../services/shared/workspace/index-manager";

// import last
import "./functions";
import { LangiumDocument } from "langium";
import { typeIndex, TypeMap } from "../types";
import { RangeGenerator } from "./range";

export type EvaluatorFunction<T = Metamodel> = (
    expression: T,
    target: ElementMeta
) => ExpressionResult;
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

export function defaultEvaluators(): Map<string, EvaluatorFunction> {
    return typeIndex.expandToDerivedTypes(Evaluators as TypeMap<SysMLType, EvaluatorFunction>);
}

export class BuiltinFunctionEvaluator implements ModelLevelExpressionEvaluator {
    protected readonly evaluators: Map<string, EvaluatorFunction>;
    protected readonly util: ModelUtil;
    protected readonly index: SysMLIndexManager;
    protected readonly stack: ElementMeta[] = [];

    constructor(services: SysMLSharedServices, evaluators: Map<string, EvaluatorFunction>) {
        this.evaluators = evaluators;
        this.util = services.Util;
        this.index = services.workspace.IndexManager;
    }

    get currentEvaluationStack(): readonly ElementMeta[] {
        return this.stack;
    }

    libraryType(qualifiedName: string, context?: ElementMeta): TypeMeta | undefined {
        let document: LangiumDocument | undefined;
        if (context) {
            let root: ElementMeta = context;
            for (;;) {
                const owner = root.owner();
                if (!owner) break;
                root = owner;
            }

            document = root.ast()?.$document;
        }
        return this.index.findType(qualifiedName, document);
    }

    evaluate(expression: Evaluable, target: ElementMeta): ExpressionResult {
        this.stack.push(expression);
        const evaluator = this.evaluators.get(expression.nodeType());
        if (evaluator) {
            const result = evaluator.call(this, expression, target);
            this.stack.pop();
            return result;
        }

        throw new Error(`No evaluator found for ${expression.nodeType()}`);
    }

    targetFeatureFor(target: ElementMeta): FeatureMeta {
        if (target.is(Feature)) return target;

        // feature created only for evaluation, parent errors are not useful here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const feature = FeatureMeta.create(this.util.idProvider, target.document);
        if (target.is(Type)) {
            const typing = FeatureTypingMeta.create(this.util.idProvider, target.document, {
                isImplied: true,
            });
            feature.addHeritage([typing, target]);
        }

        return feature;
    }

    evaluateFeatureChain(features: readonly FeatureMeta[], type: TypeMeta): ExpressionResult {
        if (features.length === 0) return [];
        const values = this.evaluateFeature(features[0], type);
        if (features.length === 1) return values;
        if (values instanceof RangeGenerator) return values;

        const subchain = features.slice(1);
        return values.flatMap((value) => {
            if (typeof value !== "object" || !value.is(Type)) return [value];

            const target = value.is(Feature)
                ? type === value
                    ? value
                    : this.util.chainFeatures(this.targetFeatureFor(type), value)
                : type;
            return normalize(this.evaluateFeatureChain(subchain, target));
        });
    }

    @evaluates(NullExpression)
    evaluateNull(): ExpressionResult {
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
    ): ExpressionResult {
        const arg = expression.args.at(index);
        if (!arg) throw new Error(`Missing argument at position ${index}`);
        return this.evaluate(arg, target);
    }

    asBoolean(expression: InvocationExpressionMeta, index: number, target: ElementMeta): boolean {
        const value = this.asArgument(expression, index, target);
        if (typeof value !== "boolean") {
            throw new Error("Not a boolean");
        }
        return value;
    }

    asString(expression: InvocationExpressionMeta, index: number, target: ElementMeta): string {
        const value = this.asArgument(expression, index, target);
        if (typeof value !== "string") {
            throw new Error("Not a string");
        }
        return value;
    }

    asNumber(expression: InvocationExpressionMeta, index: number, target: ElementMeta): number {
        const value = this.asArgument(expression, index, target);
        if (typeof value !== "number") {
            throw new Error("Not a number");
        }
        return value;
    }

    asArgument(
        expression: InvocationExpressionMeta,
        index: number,
        target: ElementMeta
    ): ExpressionResultValue | null {
        const values = this.evaluateArgument(expression, index, target);
        if (values.length > 1) {
            throw new Error("Too many values, expected 1");
        }

        if (values.length === 0) return null;
        // safe cast since there's a length check before
        return values.at(0) as ExpressionResultValue;
    }

    equal(left?: ExpressionResultValue | null, right?: ExpressionResultValue | null): boolean {
        return left === right;
    }

    @evaluates(InvocationExpression)
    evaluateInvocation(
        expression: InvocationExpressionMeta,
        target: ElementMeta
    ): ExpressionResult {
        const fn = expression.getFunction();
        if (!fn) throw new Error("No associated function found");
        const builtin = builtinFunction(fn);
        if (!builtin) throw new Error("No associated builtin function found");
        return builtin.call(expression, target, this);
    }

    @evaluates(FeatureReferenceExpression)
    evaluateFeatureReference(
        expression: FeatureReferenceExpressionMeta,
        target: ElementMeta
    ): ExpressionResult {
        const referenced = expression.expression?.element();
        if (!referenced) throw new Error("No referenced element");
        const type = target.is(Type) ? target : undefined;
        if (referenced.is(FeatureReference)) {
            const feature = referenced.to.target;
            if (!feature) throw new Error("No linked reference");
            if (!type)
                throw new Error(
                    "Cannot evaluate feature reference expression in a non-type context"
                );
            return this.evaluateFeature(feature, type);
        }
        if (referenced.is(TypeReference)) return this.evaluateReference(referenced);
        if (referenced.is(InlineExpression)) return this.evaluate(referenced, target);
        if (!type)
            throw new Error("Cannot evaluate feature reference expression in a non-type context");
        return this.evaluateFeature(referenced, type);
    }

    @evaluates(MetadataAccessExpression)
    evaluateMetadataAccess(
        expression: MetadataAccessExpressionMeta,
        target: ElementMeta
    ): ExpressionResult {
        const referenced = expression.reference;
        if (!referenced) throw new Error("No linked reference");

        const features = [...referenced.allMetadata()];
        const metaclass = referenced.metaclass;
        if (metaclass) features.push(metaclass);

        return features;
    }

    protected evaluateFeature(feature: FeatureMeta, type: TypeMeta): ExpressionResult {
        if (feature.conforms("Base::Anything::self")) {
            return [this.targetFeatureFor(type)];
        }

        if (feature.chainings.length > 0) {
            return this.evaluateFeatureChain(feature.chainingFeatures, type);
        }

        // readonly arrays can't be reversed...
        const types =
            type.is(Feature) && type.chainings.length > 0 ? [...type.chainingFeatures] : [type];

        for (const t of types.reverse()) {
            if (
                t.is(MetadataFeature) &&
                feature.conforms("Metaobjects::Metaobject::annotatedElement")
            ) {
                const annotated = t.annotatedElements().at(0) ?? t.owner();
                const metaclass = annotated?.metaclass;
                return metaclass ? [metaclass] : [];
            }

            if (isMetaclassFeature(t)) {
                if (feature.is(Expression)) continue;
                // TODO: reflection
                return [];
            }

            // need to find the corresponding feature in `t` which can be
            // evaluated
            const target = t
                .featureMembers()
                .map((member) => member.element())
                .find((f) => f?.allTypes(Redefinition).includes(feature));

            if (target) {
                const value = target.value?.element();
                if (value) return this.evaluate(value, t);
            }
        }

        const value = feature.value?.element();
        if (value) {
            return this.evaluate(value, type);
        }

        return [feature];
    }

    @evaluates(ElementReference)
    evaluateReference(ref: ElementReferenceMeta): ElementMeta[] {
        const target = ref.to.target;
        if (!target) throw new Error("No linked reference");
        return [target];
    }
}
