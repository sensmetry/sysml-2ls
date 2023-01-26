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

import { Element, FeatureChainExpression, Type, isType } from "../../generated/ast";
import { Target } from "../../utils/containers";
import { metamodelOf, ElementID } from "../metamodel";
import { OperatorExpressionMeta } from "./operator-expression";

export const ImplicitFeatureChainExpressions = {
    target: "ControlFunctions::'.'::source::target", // TODO
};

@metamodelOf(FeatureChainExpression, ImplicitFeatureChainExpressions)
export class FeatureChainExpressionMeta extends OperatorExpressionMeta {
    /**
     * Resolved reference target of the right operand
     */
    readonly right = new Target<Element>();

    constructor(node: FeatureChainExpression, id: ElementID) {
        super(node, id);
    }

    override self(): FeatureChainExpression {
        return super.deref() as FeatureChainExpression;
    }

    override reset(): void {
        super.reset();
        this.right.reset();
    }

    override getFunction(): string | undefined {
        return "ControlFunctions::'.'";
    }

    override returnType(): string | Type | undefined {
        const target = this.right.target;
        if (isType(target)) return target;
        return;
    }
}

declare module "../../generated/ast" {
    interface FeatureChainExpression {
        $meta: FeatureChainExpressionMeta;
    }
}
