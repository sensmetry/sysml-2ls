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

import { AstNode, LangiumDocument } from "langium";
import { OperatorExpression } from "../../../generated/ast";
import { OPERATOR_FUNCTIONS, typeArgument, typeOf } from "../../expressions/util";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import { InvocationExpressionMeta, InvocationExpressionOptions, TypeMeta } from "../_internal";

export const OPERATORS = {
    IF: "'if'",
    NULL_COALESCING: "'??'",
    IMPLIES: "'implies'",
    OR: "'or'",
    BITWISE_OR: "'|'",
    XOR: "'xor'",
    AND: "'and'",
    BITWISE_AND: "'&'",
    EQUALS: "'=='",
    SAME: "'==='",
    NOT_EQUALS: "'!='",
    NOT_SAME: "'!=='",
    IS_TYPE: "'istype'",
    HAS_TYPE: "'hastype'",
    AT: "'@'",
    AT_AT: "'@@'",
    AS: "'as'",
    META: "'meta'",
    LESS: "'<'",
    LESS_EQUAL: "'<='",
    GREATER: "'>'",
    GREATER_EQUAL: "'>='",
    RANGE: "'..'",
    PLUS: "'+'",
    MINUS: "'-'",
    MULTIPLY: "'*'",
    DIVIDE: "'/'",
    MODULO: "'%'",
    EXPONENT_1: "'**'",
    EXPONENT_2: "'^'",
    BITWISE_NOT: "'~'",
    NOT: "'not'",
    ALL: "'all'",
    INDEX: "'#'",
    QUANTITY: "'['",
    COMMA: "','",
    NONE: "",
} as const;

export const IMPLICIT_OPERATORS = {
    DOT: "'.'",
    COLLECT: "collect",
    SELECT: "'.?'",
    METADATA: "'.metadata'",
} as const;

export type Operator = (typeof OPERATORS)[keyof typeof OPERATORS];
export type AnyOperator = Operator | (typeof IMPLICIT_OPERATORS)[keyof typeof IMPLICIT_OPERATORS];

export interface OperatorExpressionOptions extends InvocationExpressionOptions {
    operator?: Operator;
}

@metamodelOf(OperatorExpression)
export class OperatorExpressionMeta extends InvocationExpressionMeta {
    /**
     * The escaped operator name used in this expression, i.e. `'+'`
     */
    protected _operator: Operator = OPERATORS.NONE;
    public get operator(): AnyOperator {
        return this._operator;
    }
    public set operator(value: Operator) {
        this._operator = value;
    }

    override ast(): OperatorExpression | undefined {
        return this._ast as OperatorExpression;
    }

    override getFunction(): string | undefined {
        return OPERATOR_FUNCTIONS[this.operator];
    }

    override returnType(): string | TypeMeta | undefined {
        if (this.operator === OPERATORS.AS || this.operator === OPERATORS.META) {
            // cast operators should be treated as its type arguments
            return typeArgument(this);
        }
        if (this.operator === OPERATORS.INDEX) {
            return typeOf(this.args[0]);
        }
        if (this.operator === OPERATORS.QUANTITY) {
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
