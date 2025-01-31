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

import { ConcernUsage, FramedConcernMembership } from "../../generated/ast";
import { GeneralType, metamodelOf } from "../metamodel";
import { RequirementUsageMeta, RequirementUsageOptions } from "./requirement-usage";

export type ConcernUsageOptions = RequirementUsageOptions;

@metamodelOf(ConcernUsage, {
    base: "Requirements::concernChecks",
    concern: "Requirements::RequirementCheck::concerns",
})
export class ConcernUsageMeta extends RequirementUsageMeta {
    override ast(): ConcernUsage | undefined {
        return this._ast as ConcernUsage;
    }

    override defaultSupertype(): string {
        return "base";
    }

    override defaultGeneralTypes(): GeneralType[] {
        const supertypes = super.defaultGeneralTypes();

        if (this.isSubrequirement()) {
            supertypes.push("subrequirement");
        }

        return supertypes;
    }

    override requirementConstraintSupertype(): string | undefined {
        return this.parent()?.is(FramedConcernMembership)
            ? "concern"
            : super.requirementConstraintKind();
    }
}

declare module "../../generated/ast" {
    interface ConcernUsage {
        $meta: ConcernUsageMeta;
    }
}
