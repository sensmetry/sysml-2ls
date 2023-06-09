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
    FeatureMembership,
    FeatureReferenceExpression,
    SysMLFunction,
} from "../../../generated/ast";
import { metamodelOf } from "../../metamodel";
import { ElementParts, ExpressionMeta, FeatureMeta, MembershipMeta, TypeMeta } from "../_internal";

@metamodelOf(FeatureReferenceExpression)
export class FeatureReferenceExpressionMeta extends ExpressionMeta {
    private _expression?: MembershipMeta<FeatureMeta> | undefined;

    get expression(): MembershipMeta<FeatureMeta> | undefined {
        return this._expression;
    }
    setExpression(value: MembershipMeta<FeatureMeta>): this {
        this._expression = value;
        return this;
    }

    override ast(): FeatureReferenceExpression | undefined {
        return this._ast as FeatureReferenceExpression;
    }
    override returnType(): TypeMeta | string | undefined {
        const expr = this.expression?.element();
        if (!expr || !this.expression?.is(FeatureMembership)) return expr;
        if (expr.isAny(Expression, SysMLFunction)) return expr.returnType();
        return expr;
    }

    override isModelLevelEvaluable(): boolean {
        return true;
    }

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);

        if (this.expression) parts.push(["expression", [this.expression]]);
    }
}

declare module "../../../generated/ast" {
    interface FeatureReferenceExpression {
        $meta: FeatureReferenceExpressionMeta;
    }
}
