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

import { InlineExpression } from "../../generated/ast";
import { BasicMetamodel, ElementID, metamodelOf, ModelContainer } from "../metamodel";
import { TypeMeta } from "./_internal";

@metamodelOf(InlineExpression)
export class InlineExpressionMeta extends BasicMetamodel<InlineExpression> {
    constructor(id: ElementID, parent: ModelContainer<InlineExpression>) {
        super(id, parent);
    }

    override self(): InlineExpression | undefined {
        return super.deref() as InlineExpression;
    }

    override parent(): ModelContainer<InlineExpression> {
        return this._parent;
    }

    /**
     * @returns fully qualified name or AST node of the return type of this
     * expression if one can be inferred, undefined otherwise
     */
    returnType(): TypeMeta | string | undefined {
        return;
    }
}
