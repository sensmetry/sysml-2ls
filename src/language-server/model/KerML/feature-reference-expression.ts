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

import { FeatureReferenceExpression, TypeReference } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { InlineExpressionMeta } from "./inline-expression";
import { Related, TypeMeta } from "./_internal";

@metamodelOf(FeatureReferenceExpression)
export class FeatureReferenceExpressionMeta extends InlineExpressionMeta {
    expression?: Related<InlineExpressionMeta>;

    constructor(id: ElementID, parent: ModelContainer<FeatureReferenceExpression>) {
        super(id, parent);
    }

    override initialize(node: FeatureReferenceExpression): void {
        this.expression = { element: node.expression.$meta };
    }

    override self(): FeatureReferenceExpression | undefined {
        return super.self() as FeatureReferenceExpression;
    }

    override parent(): ModelContainer<FeatureReferenceExpression> {
        return this._parent;
    }

    override returnType(): TypeMeta | string | undefined {
        const expr = this.expression?.element;
        if (!expr) return;
        if (expr.is(TypeReference)) return expr.to.target?.element;
        return expr.returnType();
    }
}

declare module "../../generated/ast" {
    interface FeatureReferenceExpression {
        $meta: FeatureReferenceExpressionMeta;
    }
}
