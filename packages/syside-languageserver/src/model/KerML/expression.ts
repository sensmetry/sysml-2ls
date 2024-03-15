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

import { Mixin } from "ts-mixer";
import { Expression, FeatureValue, Multiplicity } from "../../generated/ast";
import { isModelLevelEvaluable } from "../expressions/util";
import { ElementIDProvider, GeneralType, MetatypeProto, metamodelOf } from "../metamodel";
import { FunctionMixin } from "../mixins/function";
import {
    Edge,
    ElementParts,
    FeatureMeta,
    FunctionMeta,
    ResultExpressionMembershipMeta,
    StepMeta,
    StepOptions,
    TypeMeta,
} from "./_internal";
import { NonNullable, enumerable } from "../../utils/common";
import { AstNode, LangiumDocument } from "langium";

export const ImplicitExpressions = {
    base: "Performances::evaluations",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
};

export interface ExpressionOptions extends StepOptions {
    result?: Edge<ResultExpressionMembershipMeta>;
}

@metamodelOf(Expression, ImplicitExpressions)
export class ExpressionMeta extends Mixin(StepMeta, FunctionMixin) {
    @enumerable
    get result(): ResultExpressionMembershipMeta | undefined {
        return this._result;
    }
    set result(value: Edge<ResultExpressionMembershipMeta> | undefined) {
        this._result = this.swapEdgeOwnership(this._result, value);
    }

    override get featuredBy(): readonly TypeMeta[] {
        const featurings = super.typeFeaturings;
        if (featurings.length > 0) return featurings.map((f) => f.element()).filter(NonNullable);

        const owner = this.owner();
        if (owner?.is(Multiplicity) || this.parent()?.is(FeatureValue)) {
            return (owner as FeatureMeta).featuredBy;
        }
        return this._owningType ? [this._owningType] : [];
    }

    override defaultGeneralTypes(): GeneralType[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isStructureOwnedComposite()) supertypes.push("ownedPerformance");
        if (this.isBehaviorOwnedComposite()) supertypes.push("subperformance");
        if (this.isBehaviorOwned()) supertypes.push("enclosedPerformance");
        return supertypes;
    }

    override defaultSupertype(): string {
        return "base";
    }

    override ast(): Expression | undefined {
        return this._ast as Expression;
    }
    /**
     * @returns fully qualified name or AST node of the return type of this
     * expression if one can be inferred, undefined otherwise
     */
    returnType(): TypeMeta | string | undefined {
        return this.getReturnType(this);
    }

    getFunction(): FunctionMeta | string | undefined {
        return this.qualifiedName;
    }

    isModelLevelEvaluable(): boolean {
        const fn = this.getFunction();
        return fn ? isModelLevelEvaluable(fn) : false;
    }

    protected override collectParts(): ElementParts {
        const parts = StepMeta.prototype["collectParts"].call(this);
        if (this._result) parts.push(["result", [this._result]]);
        return parts;
    }

    protected static applyExpressionOptions(
        model: ExpressionMeta,
        options: ExpressionOptions
    ): void {
        model.result = options.result;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ExpressionOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as ExpressionMeta;
        if (options) ExpressionMeta.applyExpressionOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface Expression {
        $meta: ExpressionMeta;
    }
}
