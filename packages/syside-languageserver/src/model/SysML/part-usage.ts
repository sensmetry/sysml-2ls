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
    ActorMembership,
    CaseDefinition,
    CaseUsage,
    PartUsage,
    RequirementDefinition,
    RequirementUsage,
    StakeholderMembership,
} from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { ItemUsageMeta } from "./item-usage";

@metamodelOf(PartUsage, {
    base: "Parts::parts",
    subitem: "Items::Item::subparts",
    requirementActor: "Requirements::RequirementCheck::actors",
    requirementStakeholder: "Requirements::RequirementCheck::stakeholders",
    caseActor: "Cases::Case::actors",
})
export class PartUsageMeta extends ItemUsageMeta {
    override defaultSupertype(): string {
        if (this.isRequirementActor()) return "requirementActor";
        if (this.isRequirementStakeholder()) return "requirementStakeholder";
        if (this.isCaseActor()) return "caseActor";
        return super.defaultSupertype();
    }

    protected isRequirementActor(): boolean {
        return Boolean(
            this.parent()?.is(ActorMembership) &&
                this.owner()?.isAny(RequirementDefinition, RequirementUsage)
        );
    }

    protected isRequirementStakeholder(): boolean {
        return Boolean(
            this.parent()?.is(StakeholderMembership) &&
                this.owner()?.isAny(RequirementDefinition, RequirementUsage)
        );
    }

    protected isCaseActor(): boolean {
        return Boolean(
            this.parent()?.is(ActorMembership) && this.owner()?.isAny(CaseDefinition, CaseUsage)
        );
    }

    override isIgnoredParameter(): boolean {
        return Boolean(
            super.isIgnoredParameter() ||
                this.parent()?.isAny(ActorMembership, StakeholderMembership)
        );
    }

    override ast(): PartUsage | undefined {
        return this._ast as PartUsage;
    }
}

declare module "../../generated/ast" {
    interface PartUsage {
        $meta: PartUsageMeta;
    }
}
