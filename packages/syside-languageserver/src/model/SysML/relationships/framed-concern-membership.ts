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

import { FramedConcernMembership } from "../../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../../metamodel";
import { ConcernUsageMeta } from "../concern-usage";
import { RequirementConstraintMembershipMeta } from "./requirement-constraint-membership";

@metamodelOf(FramedConcernMembership)
export class FramedConcernMembershipMeta<
    T extends ConcernUsageMeta = ConcernUsageMeta
> extends RequirementConstraintMembershipMeta<T> {
    constructor(id: ElementID, parent: ModelContainer<FramedConcernMembership>) {
        super(id, parent);
    }

    override ast(): FramedConcernMembership | undefined {
        return this._ast as FramedConcernMembership;
    }

    override parent(): ModelContainer<FramedConcernMembership> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface FramedConcernMembership {
        $meta: FramedConcernMembershipMeta;
    }
}
