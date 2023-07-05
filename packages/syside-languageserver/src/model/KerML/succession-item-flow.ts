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
import { SuccessionItemFlow } from "../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import {
    Edge,
    EndFeatureMembershipMeta,
    ItemFlowEndMeta,
    ItemFlowMeta,
    ItemFlowOptions,
    SuccessionMeta,
    SuccessionOptions,
} from "./_internal";
import { AstNode, LangiumDocument } from "langium";

export const ImplicitSuccessionItemFlows = {
    base: "Transfers::flowTransfersBefore",
    enclosedperformance: "Performances::Performance::enclosedPerformances",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
};

export interface SuccessionItemFlowOptions extends ItemFlowOptions, SuccessionOptions {
    ends?: readonly Edge<EndFeatureMembershipMeta, ItemFlowEndMeta>[];
}

@metamodelOf(SuccessionItemFlow, ImplicitSuccessionItemFlows)
export class SuccessionItemFlowMeta extends Mixin(ItemFlowMeta, SuccessionMeta) {
    override ast(): SuccessionItemFlow | undefined {
        return this._ast as SuccessionItemFlow;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: SuccessionItemFlowOptions
    ): T["$meta"] {
        const model = SuccessionMeta.create.call(
            this,
            provider,
            document,
            options
        ) as SuccessionItemFlowMeta;
        if (options) ItemFlowMeta.applyItemFlowOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface SuccessionItemFlow {
        $meta: SuccessionItemFlowMeta;
    }
}
