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
    FeatureReferenceExpression,
    SysMLFunction,
    TypeReference,
} from "../../../generated/ast";
import { ElementID, metamodelOf, ModelContainer } from "../../metamodel";
import { ExpressionMeta, FeatureMeta, MembershipMeta, TypeMeta } from "../_internal";

@metamodelOf(FeatureReferenceExpression)
export class FeatureReferenceExpressionMeta extends ExpressionMeta {
    expression?: MembershipMeta<FeatureMeta>;

    constructor(id: ElementID, parent: ModelContainer<FeatureReferenceExpression>) {
        super(id, parent);
    }

    override initialize(node: FeatureReferenceExpression): void {
        this.expression = node.expression.$meta as MembershipMeta<FeatureMeta>;
    }

    override ast(): FeatureReferenceExpression | undefined {
        return this._ast as FeatureReferenceExpression;
    }

    override parent(): ModelContainer<FeatureReferenceExpression> {
        return this._parent;
    }

    override returnType(): TypeMeta | string | undefined {
        const expr = this.expression?.element();
        if (!expr) return;
        if (expr.is(TypeReference)) return expr.to.target;
        if (expr.isAny([Expression, SysMLFunction])) return expr.returnType();
        return expr;
    }
}

declare module "../../../generated/ast" {
    interface FeatureReferenceExpression {
        $meta: FeatureReferenceExpressionMeta;
    }
}
