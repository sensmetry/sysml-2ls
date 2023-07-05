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
import { SysMLFunction } from "../../generated/ast";
import { isModelLevelEvaluable } from "../expressions/util";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { FunctionMixin } from "../mixins/function";
import {
    BehaviorMeta,
    BehaviorOptions,
    Edge,
    ElementParts,
    ResultExpressionMembershipMeta,
    TypeMeta,
} from "./_internal";
import { AstNode, LangiumDocument } from "langium";
import { enumerable } from "../../utils";

export const ImplicitFunctions = {
    base: "Performances::Evaluation",
};

export interface FunctionOptions extends BehaviorOptions {
    result?: Edge<ResultExpressionMembershipMeta>;
}

@metamodelOf(SysMLFunction, ImplicitFunctions)
export class FunctionMeta extends Mixin(BehaviorMeta, FunctionMixin) {
    @enumerable
    get result(): ResultExpressionMembershipMeta | undefined {
        return this._result;
    }
    set result(value: Edge<ResultExpressionMembershipMeta> | undefined) {
        this._result = this.swapEdgeOwnership(this._result, value);
    }

    override ast(): SysMLFunction | undefined {
        return this._ast as SysMLFunction;
    }
    /**
     * @returns fully qualified name or AST node of the return type of this
     * expression if one can be inferred, undefined otherwise
     */
    returnType(): TypeMeta | string | undefined {
        return this.getReturnType(this);
    }

    isModelLevelEvaluable(): boolean {
        return isModelLevelEvaluable(this.qualifiedName);
    }

    protected override collectParts(): ElementParts {
        const parts = BehaviorMeta.prototype["collectParts"].call(this);
        if (this._result) parts.push(["result", [this._result]]);
        return parts;
    }

    protected static applyFunctionOptions(model: FunctionMeta, options: FunctionOptions): void {
        model.result = options.result;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: FunctionOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as FunctionMeta;
        if (options) FunctionMeta.applyFunctionOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface SysMLFunction {
        $meta: FunctionMeta;
    }
}
