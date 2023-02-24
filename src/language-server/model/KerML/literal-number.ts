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

import { LiteralNumber } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { LiteralExpressionMeta } from "./literal-expression";

export const ImplicitLiteralNumbers = {
    // can't parse ints and reals into separate node
    integer: "Performances::literalIntegerEvaluations",
    real: "Performances::literalRationalEvaluations",
};

// TODO: implement implicit kind selection

@metamodelOf(LiteralNumber, ImplicitLiteralNumbers)
export class LiteralNumberMeta extends LiteralExpressionMeta {
    isInteger = false;
    value = 0;

    constructor(id: ElementID, parent: ModelContainer<LiteralNumber>) {
        super(id, parent);
    }

    override initialize(node: LiteralNumber): void {
        // only check the cst node text for exponential or decimal notation
        this.isInteger = !/[eE.]/.test(node.$cstNode?.text ?? "");
        this.value = node.value;
    }

    override defaultSupertype(): string {
        return this.isInteger ? "integer" : "real";
    }

    override self(): LiteralNumber | undefined {
        return super.deref() as LiteralNumber;
    }

    override parent(): ModelContainer<LiteralNumber> {
        return this._parent;
    }

    override returnType(): string {
        return this.isInteger ? "ScalarValues::Rational" : "ScalarValues::Integer";
    }
}

declare module "../../generated/ast" {
    interface LiteralNumber {
        $meta: LiteralNumberMeta;
    }
}
