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

import { LiteralBoolean } from "../../../generated/ast";
import { metamodelOf } from "../../metamodel";
import { LiteralExpressionMeta } from "../_internal";

export const ImplicitLiteralBooleans = {
    base: "Performances::literalBooleanEvaluations",
};

// TODO: implement implicit kind selection

@metamodelOf(LiteralBoolean, ImplicitLiteralBooleans)
export class LiteralBooleanMeta extends LiteralExpressionMeta {
    literal = false;

    override ast(): LiteralBoolean | undefined {
        return this._ast as LiteralBoolean;
    }

    override returnType(): string {
        return "ScalarValues::Boolean";
    }
}

declare module "../../../generated/ast" {
    interface LiteralBoolean {
        $meta: LiteralBooleanMeta;
    }
}
