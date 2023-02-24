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
    CaseDefinition,
    CaseUsage,
    PartUsage,
    RequirementDefinition,
    RequirementUsage,
} from "../../generated/ast";
import { getParameterKind, ParameterKind } from "../enums";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ItemUsageMeta } from "./item-usage";

@metamodelOf(PartUsage, {
    base: "Parts::parts",
    subitem: "Items::Item::subparts",
    requirementActor: "Requirements::RequirementCheck::actors",
    requirementStakeholder: "Requirements::RequirementCheck::stakeholders",
    caseActor: "Cases::Case::actors",
})
export class PartUsageMeta extends ItemUsageMeta {
    parameterKind: ParameterKind = "none";

    constructor(id: ElementID, parent: ModelContainer<PartUsage>) {
        super(id, parent);
    }

    override initialize(node: PartUsage): void {
        this.parameterKind = getParameterKind(node);
    }

    override defaultSupertype(): string {
        if (this.isRequirementActor()) return "requirementActor";
        if (this.isRequirementStakeholder()) return "requirementStakeholder";
        if (this.isCaseActor()) return "caseActor";
        return super.defaultSupertype();
    }

    protected isRequirementActor(): boolean {
        const parent = this.parent();
        return (
            this.parameterKind === "actor" &&
            parent.isAny([RequirementDefinition, RequirementUsage])
        );
    }

    protected isRequirementStakeholder(): boolean {
        const parent = this.parent();
        return (
            this.parameterKind === "stakeholder" &&
            parent.isAny([RequirementDefinition, RequirementUsage])
        );
    }

    protected isCaseActor(): boolean {
        const parent = this.parent();
        return this.parameterKind === "actor" && parent.isAny([CaseDefinition, CaseUsage]);
    }

    override isIgnoredParameter(): boolean {
        return super.isIgnoredParameter() || this.parameterKind !== "none";
    }

    override self(): PartUsage | undefined {
        return super.self() as PartUsage;
    }

    override parent(): ModelContainer<PartUsage> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface PartUsage {
        $meta: PartUsageMeta;
    }
}
