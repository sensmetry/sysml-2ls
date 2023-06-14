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

import { LiteralInfinity } from "../../../generated/ast";
import { metamodelOf } from "../../metamodel";
import { LiteralExpressionMeta, LiteralExpressionOptions } from "../_internal";

export const ImplicitLiteralInfinities = {
    base: "Performances::literalIntegerEvaluations",
};

export type LiteralInfinityOptions = LiteralExpressionOptions;

@metamodelOf(LiteralInfinity, ImplicitLiteralInfinities)
export class LiteralInfinityMeta extends LiteralExpressionMeta {
    override ast(): LiteralInfinity | undefined {
        return this._ast as LiteralInfinity;
    }

    override returnType(): string {
        return "ScalarValues::Positive";
    }
}

declare module "../../../generated/ast" {
    interface LiteralInfinity {
        $meta: LiteralInfinityMeta;
    }
}
