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

import { InvocationExpression, Expression, SysMLFunction } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { InlineExpressionMeta } from "./inline-expression";
import { ArgumentMeta, TypeMeta } from "./_internal";

@metamodelOf(InvocationExpression)
export class InvocationExpressionMeta extends InlineExpressionMeta {
    type?: TypeMeta;
    // undefined for references that failed to link
    args: (ArgumentMeta | TypeMeta | InlineExpressionMeta | undefined)[] = [];

    constructor(id: ElementID, parent: ModelContainer<InvocationExpression>) {
        super(id, parent);
    }

    override reset(_: InvocationExpression): void {
        this.args.length = 0;
    }

    override self(): InvocationExpression | undefined {
        return super.self() as InvocationExpression;
    }

    override parent(): ModelContainer<InvocationExpression> {
        return this._parent;
    }

    /**
     * @returns fully qualified name of the invoked function
     */
    getFunction(): string | undefined {
        return this.type?.qualifiedName;
    }

    override returnType(): string | TypeMeta | undefined {
        const type = this.type;
        if (type?.isAny([Expression, SysMLFunction])) return type.returnType();
        return type;
    }
}

declare module "../../generated/ast" {
    interface InvocationExpression {
        $meta: InvocationExpressionMeta;
    }
}
