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
import { NonNullable, enumerable } from "../../utils";
import { ElementParts, FeatureMeta, MembershipMeta, ParameterMembershipMeta } from "../KerML";
import { metamodelOf } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";
import { ReferenceUsageMeta } from "./reference-usage";

@metamodelOf(SendActionUsage, {
    base: "Actions::sendActions",
    subaction: "Actions::Action::sendSubactions",
})
export class SendActionUsageMeta extends ActionUsageMeta {
    private _payload?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;
    private _sender?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;
    private _receiver?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;

    @enumerable
    public get payload(): ParameterMembershipMeta<ReferenceUsageMeta> | undefined {
        return this._payload;
    }
    public set payload(value: ParameterMembershipMeta<ReferenceUsageMeta>) {
        this._payload = value;
    }

    @enumerable
    public get sender(): ParameterMembershipMeta<ReferenceUsageMeta> | undefined {
        return this._sender;
    }
    public set sender(value: ParameterMembershipMeta<ReferenceUsageMeta> | undefined) {
        this._sender = value;
    }

    @enumerable
    public get receiver(): ParameterMembershipMeta<ReferenceUsageMeta> | undefined {
        return this._receiver;
    }
    public set receiver(value: ParameterMembershipMeta<ReferenceUsageMeta> | undefined) {
        this._receiver = value;
    }

    override ast(): SendActionUsage | undefined {
        return this._ast as SendActionUsage;
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = FeatureMeta.prototype.featureMembers.call(this);
        return (
            [this.payload, this.sender, this.receiver] as (
                | MembershipMeta<FeatureMeta>
                | undefined
            )[]
        )
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    override textualParts(): ElementParts {
        const parts: ElementParts = { prefixes: this.prefixes };
        if (this.multiplicity) parts.multiplicity = [this.multiplicity];
        parts.heritage = this.heritage;

        if (this.payload) parts.payload = [this.payload];
        if (this.sender) parts.sender = [this.sender];
        if (this.receiver) parts.body = [this.receiver];

        parts.children = this.children;
        return parts;
    }
}

declare module "../../generated/ast" {
    interface SendActionUsage {
        $meta: SendActionUsageMeta;
    }
}
