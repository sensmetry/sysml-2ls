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

import { SendActionUsage } from "../../generated/ast";
import { ParameterMembershipMeta } from "../KerML";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";

@metamodelOf(SendActionUsage, {
    base: "Actions::sendActions",
    subaction: "Actions::Action::sendSubactions",
})
export class SendActionUsageMeta extends ActionUsageMeta {
    payload?: ParameterMembershipMeta;
    sender?: ParameterMembershipMeta;
    receiver?: ParameterMembershipMeta;

    constructor(id: ElementID, parent: ModelContainer<SendActionUsage>) {
        super(id, parent);
    }

    override ast(): SendActionUsage | undefined {
        return this._ast as SendActionUsage;
    }

    override parent(): ModelContainer<SendActionUsage> {
        return this._parent;
    }

    override initialize(node: SendActionUsage): void {
        this.payload = node.payload.$meta;
        this.sender = node.sender?.$meta;
        this.receiver = node.receiver?.$meta;
    }

    override collectChildren(node: SendActionUsage): void {
        this.members.push(node.payload.$meta);
        if (node.sender) this.members.push(node.sender.$meta);
        if (node.receiver) this.members.push(node.receiver.$meta);

        super.collectChildren(node);
    }
}

declare module "../../generated/ast" {
    interface SendActionUsage {
        $meta: SendActionUsageMeta;
    }
}
