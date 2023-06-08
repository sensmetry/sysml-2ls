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

import { ConcernUsage, FramedConcernMembership } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { RequirementUsageMeta } from "./requirement-usage";

@metamodelOf(ConcernUsage, {
    base: "Requirements::concernChecks",
    subrequirement: "Requirements::RequirementCheck::concerns",
})
export class ConcernUsageMeta extends RequirementUsageMeta {
    override ast(): ConcernUsage | undefined {
        return this._ast as ConcernUsage;
    }

    override requirementConstraintSupertype(): string | undefined {
        return this.parent()?.is(FramedConcernMembership)
            ? "subrequirement"
            : super.requirementConstraintKind();
    }
}

declare module "../../generated/ast" {
    interface ConcernUsage {
        $meta: ConcernUsageMeta;
    }
}
