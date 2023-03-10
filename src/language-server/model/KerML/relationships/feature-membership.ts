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

import { mix } from "ts-mixer";
import { FeatureMembership } from "../../../generated/ast";
import { ElementID, metamodelOf, ModelContainer } from "../../metamodel";
import { FeatureMeta } from "../feature";
import { FeaturingMeta } from "./featuring";
import { OwningMembershipMeta } from "./owning-membership";

export interface FeatureMembershipMeta<T extends FeatureMeta = FeatureMeta>
    extends OwningMembershipMeta<T>,
        FeaturingMeta<T> {}

@metamodelOf(FeatureMembership)
@mix(OwningMembershipMeta, FeaturingMeta)
// eslint-disable-next-line unused-imports/no-unused-vars
export class FeatureMembershipMeta<T extends FeatureMeta = FeatureMeta> {
    // eslint-disable-next-line unused-imports/no-unused-vars
    constructor(id: ElementID, parent: ModelContainer<FeatureMembership>) {
        // should be handled by ts-mixer
        // super(id, parent);
    }

    ast(): FeatureMembership | undefined {
        return this._ast as FeatureMembership;
    }

    parent(): ModelContainer<FeatureMembership> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface FeatureMembership {
        $meta: FeatureMembershipMeta;
    }
}
