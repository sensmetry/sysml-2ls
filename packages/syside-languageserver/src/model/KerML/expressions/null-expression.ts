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

import { NullExpression } from "../../../generated/ast";
import { ElementID, metamodelOf, ModelContainer } from "../../metamodel";
import { ExpressionMeta, TypeMeta } from "../_internal";

export const ImplicitNullExpressions = {
    base: "Performances::nullEvaluations",
};

// TODO: implement implicit kind selection

@metamodelOf(NullExpression, ImplicitNullExpressions)
export class NullExpressionMeta extends ExpressionMeta {
    constructor(id: ElementID, parent: ModelContainer<NullExpression>) {
        super(id, parent);
    }

    override ast(): NullExpression | undefined {
        return this._ast as NullExpression;
    }

    override parent(): ModelContainer<NullExpression> {
        return this._parent;
    }

    override returnType(): string | TypeMeta | undefined {
        return undefined;
    }

    override isModelLevelEvaluable(): boolean {
        return true;
    }
}

declare module "../../../generated/ast" {
    interface NullExpression {
        $meta: NullExpressionMeta;
    }
}
