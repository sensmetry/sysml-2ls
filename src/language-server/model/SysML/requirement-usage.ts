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

import {
    RequirementDefinition,
    RequirementUsage,
    VerificationCaseDefinition,
    VerificationCaseUsage,
} from "../../generated/ast";
import { getRequirementKind, RequirementKind } from "../enums";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ConstraintUsageMeta } from "./constraint-usage";

@metamodelOf(RequirementUsage, {
    base: "Requirements::requirementChecks",
    subrequirement: "Requirements::RequirementCheck::subrequirements",
})
export class RequirementUsageMeta extends ConstraintUsageMeta {
    requirementKind: RequirementKind = "none";

    constructor(id: ElementID, parent: ModelContainer<RequirementUsage>) {
        super(id, parent);
    }

    override initialize(node: RequirementUsage): void {
        this.requirementKind = getRequirementKind(node);
    }

    override defaultSupertype(): string {
        return this.isSubrequirement() ? "subrequirement" : "base";
    }

    isVerifiedRequirement(): boolean {
        if (this.requirementKind !== "verification") return false;

        let parent = this.parent();
        if (!parent.is(RequirementUsage) || parent.requirementKind !== "objective") return false;

        parent = parent.parent();
        return parent.isAny([VerificationCaseDefinition, VerificationCaseUsage]);
    }

    isSubrequirement(): boolean {
        if (this.constraintKind === "assumption") return false;
        const parent = this.parent();
        return parent.isAny([RequirementUsage, RequirementDefinition]);
    }

    override self(): RequirementUsage | undefined {
        return super.self() as RequirementUsage;
    }

    override parent(): ModelContainer<RequirementUsage> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface RequirementUsage {
        $meta: RequirementUsageMeta;
    }
}
