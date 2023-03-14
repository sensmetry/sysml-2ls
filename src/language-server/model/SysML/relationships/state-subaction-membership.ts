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

import { StateSubactionKind, StateSubactionMembership } from "../../../generated/ast";
import { FeatureMembershipMeta } from "../../KerML/relationships/feature-membership";
import { metamodelOf, ElementID, ModelContainer } from "../../metamodel";
import { ActionUsageMeta } from "../action-usage";

@metamodelOf(StateSubactionMembership)
export class StateSubactionMembershipMeta<
    T extends ActionUsageMeta = ActionUsageMeta
> extends FeatureMembershipMeta<T> {
    kind: StateSubactionKind = "entry";

    constructor(id: ElementID, parent: ModelContainer<StateSubactionMembership>) {
        super(id, parent);
    }

    override initialize(node: StateSubactionMembership): void {
        this.kind = node.kind;
    }

    override ast(): StateSubactionMembership | undefined {
        return this._ast as StateSubactionMembership;
    }

    override parent(): ModelContainer<StateSubactionMembership> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface StateSubactionMembership {
        $meta: StateSubactionMembershipMeta;
    }
}
