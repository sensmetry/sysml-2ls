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

import { ObjectiveMembership } from "../../../generated/ast";
import { FeatureMembershipMeta } from "../../KerML/relationships/feature-membership";
import { metamodelOf, ElementID, ModelContainer } from "../../metamodel";
import { RequirementUsageMeta } from "../requirement-usage";

@metamodelOf(ObjectiveMembership)
export class ObjectiveMembershipMeta<
    T extends RequirementUsageMeta = RequirementUsageMeta
> extends FeatureMembershipMeta<T> {
    constructor(id: ElementID, parent: ModelContainer<ObjectiveMembership>) {
        super(id, parent);
    }

    override ast(): ObjectiveMembership | undefined {
        return this._ast as ObjectiveMembership;
    }

    override parent(): ModelContainer<ObjectiveMembership> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface ObjectiveMembership {
        $meta: ObjectiveMembershipMeta;
    }
}
