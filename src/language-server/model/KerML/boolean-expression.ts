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

import { BooleanExpression } from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { ExpressionMeta } from "./expression";

export const ImplicitBooleanExpressions = {
    base: "Performances::booleanEvaluations",
};

@metamodelOf(BooleanExpression, ImplicitBooleanExpressions)
export class BooleanExpressionMeta extends ExpressionMeta {
    constructor(node: BooleanExpression, id: ElementID) {
        super(node, id);
    }

    override self(): BooleanExpression {
        return super.deref() as BooleanExpression;
    }
}

declare module "../../generated/ast" {
    interface BooleanExpression {
        $meta: BooleanExpressionMeta;
    }
}
