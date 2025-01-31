/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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
    InvocationExpression,
    ParameterMembership,
    SysMLFunction,
} from "../../../generated/ast";
import { NonNullable, enumerable } from "../../../utils/common";
import { metamodelOf } from "../../metamodel";
import {
    ElementParts,
    ExpressionMeta,
    ExpressionOptions,
    FeatureMeta,
    TypeMeta,
} from "../_internal";

export type InvocationExpressionOptions = ExpressionOptions;

@metamodelOf(InvocationExpression)
export class InvocationExpressionMeta extends ExpressionMeta {
    protected _args: readonly ExpressionMeta[] = [];

    /**
     * Cached version of {@link arguments} that is populated during model build
     * time
     */
    get args(): readonly ExpressionMeta[] {
        return this._args;
    }

    // this only exists for compatibility with AST since we don't construct the
    // missing intermediate elements to operands
    protected _operands: ExpressionMeta[] = [];

    @enumerable
    get operands(): readonly ExpressionMeta[] {
        return this._operands;
    }

    argumentMembers(): readonly FeatureMeta[] {
        return this._children.get(ParameterMembership).map((m) => m.element());
    }

    arguments(): readonly ExpressionMeta[] {
        return [
            ...this.operands,
            ...this.argumentMembers()
                .map((f) => f.value?.element())
                .filter(NonNullable),
        ];
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

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        parts.push(["operands", this.operands]);
    }
}

declare module "../../../generated/ast" {
    interface InvocationExpression {
        $meta: InvocationExpressionMeta;
    }
}
