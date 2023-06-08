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

import { LiteralNumber } from "../../../generated/ast";
import { enumerable } from "../../../utils";
import { metamodelOf } from "../../metamodel";
import { LiteralExpressionMeta } from "../_internal";

export const ImplicitLiteralNumbers = {
    // can't parse ints and reals into separate node
    integer: "Performances::literalIntegerEvaluations",
    real: "Performances::literalRationalEvaluations",
};

// TODO: implement implicit kind selection

@metamodelOf(LiteralNumber, ImplicitLiteralNumbers)
export class LiteralNumberMeta extends LiteralExpressionMeta {
    protected _isInteger = false;
    protected _literal = 0;

    @enumerable
    get literal(): number {
        return this._literal;
    }
    set literal(value) {
        this._literal = value;
        this._isInteger = Number.isInteger(value);
    }

    get isInteger(): boolean {
        return this._isInteger;
    }

    override defaultSupertype(): string {
        return this.isInteger ? "integer" : "real";
    }

    override ast(): LiteralNumber | undefined {
        return this._ast as LiteralNumber;
    }

    override returnType(): string {
        return this.isInteger ? "ScalarValues::Rational" : "ScalarValues::Integer";
    }
}

declare module "../../../generated/ast" {
    interface LiteralNumber {
        $meta: LiteralNumberMeta;
    }
}
