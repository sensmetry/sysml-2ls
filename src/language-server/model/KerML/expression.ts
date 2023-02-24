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
import { Expression } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { FunctionMixin } from "../mixins/function";
import { StepMeta } from "./step";
import { TypeMeta } from "./type";
import { Related, FeatureMeta, castToRelated } from "./_internal";

export const ImplicitExpressions = {
    base: "Performances::evaluations",
    enclosedPerformance: "Performances::Performance::enclosedEvaluations",
};

@metamodelOf(Expression, ImplicitExpressions)
export class ExpressionMeta extends Mixin(StepMeta, FunctionMixin) {
    returns: Related<FeatureMeta>[] = [];

    constructor(id: ElementID, parent: ModelContainer<Expression>) {
        super(id, parent);
    }

    override initialize(node: Expression): void {
        if (node.result) this.result = castToRelated(node.result.$meta);

        this.returns = node.return.map((f) => ({ element: f.$meta }));
    }

    override reset(node: Expression): void {
        this.initialize(node);
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isOwnedPerformance()) supertypes.push("ownedPerformance");
        if (this.isSubperformance()) supertypes.push("subperformance");
        if (this.isEnclosedPerformance()) supertypes.push("enclosedPerformance");
        return supertypes;
    }

    override defaultSupertype(): string {
        return "base";
    }

    override self(): Expression | undefined {
        return super.deref() as Expression;
    }

    override parent(): ModelContainer<Expression> {
        return this._parent;
    }

    /**
     * @returns fully qualified name or AST node of the return type of this
     * expression if one can be inferred, undefined otherwise
     */
    returnType(): TypeMeta | string | undefined {
        return this.getReturnType(this);
    }
}

declare module "../../generated/ast" {
    interface Expression {
        $meta: ExpressionMeta;
    }
}
