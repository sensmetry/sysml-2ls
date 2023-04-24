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

import { ReturnParameterMembership } from "../../generated/ast";
import { ExpressionMeta, FunctionMeta, TypeMeta } from "../KerML/_internal";

export class FunctionMixin {
    /**
     * Get the expected return type of a function or expression
     * @param self AST node that owns this metamodel
     * @returns the return type or its qualified name if one was inferred, undefined otherwise
     */
    protected getReturnType(
        self: FunctionMeta | ExpressionMeta | undefined
    ): TypeMeta | string | undefined {
        if (!self) return;
        if (self.result) {
            return self.result.element()?.returnType();
        }
        // TODO: multiple return statements?
        return self.features.find((m) => m.is(ReturnParameterMembership))?.element();
    }
}
