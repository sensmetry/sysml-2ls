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

import { IfActionUsage } from "../../generated/ast";
import { ParameterMembershipMeta } from "../KerML";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";

@metamodelOf(IfActionUsage, {
    base: "Actions::ifThenActions",
    ifThenElse: "Actions::ifThenElseActions",
    subaction: "Actions::Action::ifSubactions",
})
export class IfActionUsageMeta extends ActionUsageMeta {
    else?: ParameterMembershipMeta<ActionUsageMeta>;

    constructor(id: ElementID, parent: ModelContainer<IfActionUsage>) {
        super(id, parent);
    }

    override initialize(node: IfActionUsage): void {
        if (node.members.length > 2)
            this.else = node.members[2].$meta as ParameterMembershipMeta<ActionUsageMeta>;
    }

    override reset(node: IfActionUsage): void {
        this.initialize(node);
    }

    override ast(): IfActionUsage | undefined {
        return this._ast as IfActionUsage;
    }

    override parent(): ModelContainer<IfActionUsage> {
        return this._parent;
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isIfThenElse()) supertypes.push("ifThenElse");
        return supertypes;
    }

    isIfThenElse(): boolean {
        return this.else !== undefined;
    }
}

declare module "../../generated/ast" {
    interface IfActionUsage {
        $meta: IfActionUsageMeta;
    }
}
