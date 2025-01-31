/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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

import { Feature, FeatureChainExpression, Membership } from "../../../generated/ast";
import { metamodelOf } from "../../metamodel";
import {
    FeatureMeta,
    OperatorExpressionMeta,
    OperatorExpressionOptions,
    TypeMeta,
} from "../_internal";

export const ImplicitFeatureChainExpressions = {
    target: "ControlFunctions::'.'::source::target", // TODO
};

export interface FeatureChainExpressionOptions extends OperatorExpressionOptions {
    operator?: never;
}

@metamodelOf(FeatureChainExpression, ImplicitFeatureChainExpressions)
export class FeatureChainExpressionMeta extends OperatorExpressionMeta {
    targetFeature(): FeatureMeta | undefined {
        const target = this._children
            .get(Membership)
            .at(Math.max(0, 1 - this.operands.length))
            ?.element();

        return target?.is(Feature) ? target : undefined;
    }

    override ast(): FeatureChainExpression | undefined {
        return this._ast as FeatureChainExpression;
    }
    override getFunction(): string | undefined {
        return "ControlFunctions::'.'";
    }

    override returnType(): string | TypeMeta | undefined {
        return this.targetFeature()?.basicFeature();
    }
}

declare module "../../../generated/ast" {
    interface FeatureChainExpression {
        $meta: FeatureChainExpressionMeta;
    }
}
