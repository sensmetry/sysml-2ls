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

import { Expression, InvocationExpression, SysMLFunction } from "../../../generated/ast";
import { ElementID, metamodelOf, ModelContainer } from "../../metamodel";
import { ExpressionMeta, FeatureMeta, TypeMeta } from "../_internal";

@metamodelOf(InvocationExpression)
export class InvocationExpressionMeta extends ExpressionMeta {
    args: (FeatureMeta | undefined)[] = [];

    constructor(id: ElementID, parent: ModelContainer<InvocationExpression>) {
        super(id, parent);
    }

    override reset(_: InvocationExpression): void {
        /* empty */
    }

    override ast(): InvocationExpression | undefined {
        return this._ast as InvocationExpression;
    }

    override parent(): ModelContainer<InvocationExpression> {
        return this._parent;
    }

    invokes(): TypeMeta | undefined {
        return this.types().head();
    }

    /**
     * @returns fully qualified name of the invoked function
     */
    override getFunction(): string | undefined {
        return this.invokes()?.qualifiedName;
    }

    override returnType(): string | TypeMeta | undefined {
        const type = this.invokes();
        if (type?.isAny([Expression, SysMLFunction])) return type.returnType();
        return type;
    }
}

declare module "../../../generated/ast" {
    interface InvocationExpression {
        $meta: InvocationExpressionMeta;
    }
}
