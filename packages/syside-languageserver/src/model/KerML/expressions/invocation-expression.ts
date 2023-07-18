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

import {
    Expression,
    Feature,
    InvocationExpression,
    Membership,
    SysMLFunction,
} from "../../../generated/ast";
import { BasicMetamodel, metamodelOf } from "../../metamodel";
import { ExpressionMeta, ExpressionOptions, FeatureMeta, TypeMeta } from "../_internal";

export type InvocationExpressionOptions = ExpressionOptions;

@metamodelOf(InvocationExpression)
export class InvocationExpressionMeta extends ExpressionMeta {
    protected _args: readonly FeatureMeta[] = [];

    /**
     * Cached version of {@link arguments} that is populated during model build
     * time
     */
    get args(): readonly FeatureMeta[] {
        return this._args;
    }

    arguments(): readonly FeatureMeta[] {
        return this.children
            .filter(BasicMetamodel.is(Membership))
            .map((m) => m.element())
            .filter(BasicMetamodel.is(Feature));
    }

    override ast(): InvocationExpression | undefined {
        return this._ast as InvocationExpression;
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
        if (type?.isAny(Expression, SysMLFunction)) return type.returnType();
        return type;
    }
}

declare module "../../../generated/ast" {
    interface InvocationExpression {
        $meta: InvocationExpressionMeta;
    }
}
