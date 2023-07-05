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

import { AstNode, LangiumDocument } from "langium";
import {
    Expression,
    FeatureMembership,
    FeatureReferenceExpression,
    SysMLFunction,
} from "../../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import {
    Edge,
    ElementParts,
    ExpressionMeta,
    ExpressionOptions,
    FeatureMeta,
    MembershipMeta,
    TypeMeta,
} from "../_internal";

export interface FeatureReferenceExpressionOptions extends ExpressionOptions {
    expression: Edge<MembershipMeta, FeatureMeta>;
}

@metamodelOf(FeatureReferenceExpression)
export class FeatureReferenceExpressionMeta extends ExpressionMeta {
    private _expression?: MembershipMeta<FeatureMeta> | undefined;

    /**
     * Membership to the feature this expression evaluates as
     */
    get expression(): MembershipMeta<FeatureMeta> | undefined {
        return this._expression;
    }
    /**
     * Takes ownership of the membership and breaks its ownership to the
     * previous expression membership. Use `FeatureMembership` to return the
     * target directly, otherwise the target will be evaluated.
     */
    set expression(value: Edge<MembershipMeta, FeatureMeta> | undefined) {
        this._expression = this.swapEdgeOwnership(this._expression, value);
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

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: FeatureReferenceExpressionOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as FeatureReferenceExpressionMeta;
        if (options) model.expression = options.expression;
        return model;
    }
}

declare module "../../../generated/ast" {
    interface FeatureReferenceExpression {
        $meta: FeatureReferenceExpressionMeta;
    }
}
