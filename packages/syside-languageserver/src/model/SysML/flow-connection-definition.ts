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

import { Mixin } from "ts-mixer";
import { FlowConnectionDefinition } from "../../generated/ast";
import { InteractionMeta, InteractionOptions } from "../KerML/interaction";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionDefinitionMeta, ActionDefinitionOptions } from "./action-definition";
import { ConnectionDefinitionMeta, ConnectionDefinitionOptions } from "./connection-definition";
import { AstNode, LangiumDocument } from "langium";

export interface FlowConnectionDefinitionOptions
    extends InteractionOptions,
        ActionDefinitionOptions,
        ConnectionDefinitionOptions {}

@metamodelOf(FlowConnectionDefinition, {
    base: "Connections::Connection",
    binary: "Connections::MessageConnection",
})
// @ts-expect-error ignoring static inheritance error
export class FlowConnectionDefinitionMeta extends Mixin(
    InteractionMeta,
    ActionDefinitionMeta,
    ConnectionDefinitionMeta
) {
    override ast(): FlowConnectionDefinition | undefined {
        return this._ast as FlowConnectionDefinition;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: FlowConnectionDefinitionOptions
    ): T["$meta"] {
        const model = ConnectionDefinitionMeta.create.call(
            this,
            provider,
            document,
            options
        ) as FlowConnectionDefinitionMeta;
        return model;
    }
}

declare module "../../generated/ast" {
    interface FlowConnectionDefinition {
        $meta: FlowConnectionDefinitionMeta;
    }
}
