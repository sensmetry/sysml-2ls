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
    FeatureReferenceExpression,
    Type,
    isExpression,
    isSysMLFunction,
    isTypeReference,
} from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { InlineExpressionMeta } from "./inline-expression";

@metamodelOf(FeatureReferenceExpression)
export class FeatureReferenceExpressionMeta extends InlineExpressionMeta {
    constructor(node: FeatureReferenceExpression, id: ElementID) {
        super(node, id);
    }

    override self(): FeatureReferenceExpression {
        return super.self() as FeatureReferenceExpression;
    }

    override returnType(): Type | string | undefined {
        const expr = this.self().expression;
        if (isTypeReference(expr)) return expr.$meta.to.target;
        // OR-ing (||) results in ridiculous compile times...
        if (isExpression(expr)) return expr.$meta.returnType();
        if (isSysMLFunction(expr)) return expr.$meta.returnType();
        return expr.$meta.returnType();
    }
}

declare module "../../generated/ast" {
    interface FeatureReferenceExpression {
        $meta: FeatureReferenceExpressionMeta;
    }
}
