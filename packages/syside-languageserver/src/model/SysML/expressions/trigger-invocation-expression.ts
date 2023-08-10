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
import { TriggerInvocationExpression } from "../../../generated/ast";
import {
    InvocationExpressionMeta,
    InvocationExpressionOptions,
} from "../../KerML/expressions/invocation-expression";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";

export type TriggerInvocationExpressionKind = "when" | "at" | "after";

export interface TriggerInvocationExpressionOptions extends InvocationExpressionOptions {
    kind: TriggerInvocationExpressionKind;
}

@metamodelOf(TriggerInvocationExpression, {
    when: "Triggers::TriggerWhen",
    at: "Triggers::TriggerAt",
    after: "Triggers::TriggerAfter",
})
export class TriggerInvocationExpressionMeta extends InvocationExpressionMeta {
    kind: TriggerInvocationExpressionKind = "when";
    override ast(): TriggerInvocationExpression | undefined {
        return this._ast as TriggerInvocationExpression;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: TriggerInvocationExpressionOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as TriggerInvocationExpressionMeta;
        if (options) model.kind = options.kind;
        return model;
    }
}

declare module "../../../generated/ast" {
    interface TriggerInvocationExpression {
        $meta: TriggerInvocationExpressionMeta;
    }
}
