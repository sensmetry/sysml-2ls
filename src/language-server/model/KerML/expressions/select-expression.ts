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

import { SelectExpression } from "../../../generated/ast";
import { ElementID, metamodelOf, ModelContainer } from "../../metamodel";
import { OperatorExpressionMeta } from "../_internal";

@metamodelOf(SelectExpression)
export class SelectExpressionMeta extends OperatorExpressionMeta {
    constructor(id: ElementID, parent: ModelContainer<SelectExpression>) {
        super(id, parent);
    }

    override ast(): SelectExpression | undefined {
        return this._ast as SelectExpression;
    }

    override parent(): ModelContainer<SelectExpression> {
        return this._parent;
    }

    override getFunction(): string | undefined {
        return "ControlFunctions::select";
    }
}

declare module "../../../generated/ast" {
    interface SelectExpression {
        $meta: SelectExpressionMeta;
    }
}
