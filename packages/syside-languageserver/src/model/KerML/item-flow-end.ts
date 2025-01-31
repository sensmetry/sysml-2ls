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

import { ItemFlowEnd } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { EndFeatureMembershipMeta, FeatureMeta, FeatureOptions } from "./_internal";

export const ImplicitItemFlowEnds = {
    sourceOutput: "Transfers::Transfer::source::sourceOutput",
    targetInput: "Transfers::Transfer::target::targetInput",
};

export interface ItemFlowEndOptions extends FeatureOptions {
    parent?: EndFeatureMembershipMeta;
}

@metamodelOf(ItemFlowEnd, ImplicitItemFlowEnds)
export class ItemFlowEndMeta extends FeatureMeta {
    override get isEnd(): boolean {
        return true;
    }
    override set isEnd(value) {
        // empty
    }
    override get isEndExplicitly(): boolean {
        return false;
    }

    override ast(): ItemFlowEnd | undefined {
        return this._ast as ItemFlowEnd;
    }
}

declare module "../../generated/ast" {
    interface ItemFlowEnd {
        $meta: ItemFlowEndMeta;
    }
}
