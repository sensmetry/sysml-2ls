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

import {
    RequirementDefinition,
    RequirementUsage,
    RequirementVerificationMembership,
} from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { ConstraintUsageMeta, ConstraintUsageOptions } from "./constraint-usage";

export type RequirementUsageOptions = ConstraintUsageOptions;

@metamodelOf(RequirementUsage, {
    base: "Requirements::requirementChecks",
    subrequirement: "Requirements::RequirementCheck::subrequirements",
    verification: "VerificationCases::VerificationCase::obj::requirementVerifications",
})
export class RequirementUsageMeta extends ConstraintUsageMeta {
    override defaultSupertype(): string {
        return this.isSubrequirement() ? "subrequirement" : "base";
    }

    isVerifiedRequirement(): boolean {
        const parent = this.parent();
        return Boolean(
            parent?.is(RequirementVerificationMembership) && parent.isLegalVerification()
        );
    }

    isSubrequirement(): boolean {
        if (this.requirementConstraintKind() === "assumption") return false;
        return Boolean(
            this.isComposite && this.owner()?.isAny(RequirementUsage, RequirementDefinition)
        );
    }

    override requirementConstraintSupertype(): string | undefined {
        return this.isVerifiedRequirement()
            ? "verification"
            : super.requirementConstraintSupertype();
    }

    override ast(): RequirementUsage | undefined {
        return this._ast as RequirementUsage;
    }
}

declare module "../../generated/ast" {
    interface RequirementUsage {
        $meta: RequirementUsageMeta;
    }
}
