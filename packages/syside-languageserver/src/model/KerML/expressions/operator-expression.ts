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

import { AstNode, LangiumDocument } from "langium";
import { OperatorExpression } from "../../../generated/ast";
import { enumerable } from "../../../utils";
import { OPERATOR_FUNCTIONS, typeArgument, typeOf } from "../../expressions/util";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import {
    ElementParts,
    ExpressionMeta,
    InvocationExpressionMeta,
    InvocationExpressionOptions,
    TypeMeta,
} from "../_internal";

export interface OperatorExpressionOptions extends InvocationExpressionOptions {
    operator?: string;
}

@metamodelOf(OperatorExpression)
export class OperatorExpressionMeta extends InvocationExpressionMeta {
    /**
     * The escaped operator name used in this expression, i.e. `'+'`
     */
    operator = "";

    // this only exists for compatibility with AST since we don't construct the
    // missing intermediate elements to operands
    protected _operands: ExpressionMeta[] = [];

    @enumerable
    get operands(): readonly ExpressionMeta[] {
        return this._operands;
    }

    override ast(): OperatorExpression | undefined {
        return this._ast as OperatorExpression;
    }

    override getFunction(): string | undefined {
        return OPERATOR_FUNCTIONS[this.operator];
    }

    override returnType(): string | TypeMeta | undefined {
        if (this.operator === "'as'" || this.operator === "'meta'") {
            // cast operators should be treated as its type arguments
            return typeArgument(this);
        }
        if (this.operator === "'#'") {
            return typeOf(this.args[0]);
        }
        if (this.operator === "'['") {
            // this is not used for indexing but setting units

            // Cannot use the argument to infer exact type so use base type, the
            // argument is a unit while the full expression should be typed by
            // quantity value. Maybe in the future we will generate mapping
            // between units and quantities to help with this
            return "Quantities::ScalarQuantityValue";
        }

        const result = this.resultParameter();
        if (result) return result.element()?.returnType();

        const returns = this.returnParameter();
        if (returns) return returns.element();

        return super.returnType();
    }

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        parts.push(["operands", this.operands]);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: OperatorExpressionOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as OperatorExpressionMeta;
        if (options?.operator) model.operator = options.operator;
        return model;
    }
}

declare module "../../../generated/ast" {
    interface OperatorExpression {
        $meta: OperatorExpressionMeta;
    }
}
