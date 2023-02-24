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

import { Mixin } from "ts-mixer";
import { ConstraintUsage, ItemDefinition, ItemUsage } from "../../generated/ast";
import { getRequirementConstraintKind, RequirementConstraintKind } from "../enums";
import { BooleanExpressionMeta } from "../KerML/boolean-expression";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { OccurrenceUsageMeta } from "./occurrence-usage";

@metamodelOf(ConstraintUsage, {
    base: "Constraints::constraintChecks",
    checkedConstraint: "Items::Item::checkedConstraints",
    enclosedPerformance: "Performances::Performance::enclosedEvaluations",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
    assumption: "Requirements::RequirementCheck::assumptions",
    requirement: "Requirements::RequirementCheck::constraints",
})
export class ConstraintUsageMeta extends Mixin(OccurrenceUsageMeta, BooleanExpressionMeta) {
    constraintKind: RequirementConstraintKind = "none";

    constructor(id: ElementID, parent: ModelContainer<ConstraintUsage>) {
        super(id, parent);
    }

    override initialize(node: ConstraintUsage): void {
        this.constraintKind = getRequirementConstraintKind(node.constraintKind);
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();

        // pushing front to match pilot
        // https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/blob/master/org.omg.sysml/src/org/omg/sysml/adapter/ConstraintUsageAdapter.java#L85
        if (this.constraintKind !== "none") supertypes.unshift(this.constraintKind);

        if (this.isCheckedConstraint()) supertypes.push("checkedConstraint");
        if (this.isOwnedPerformance()) supertypes.push("ownedPerformance");
        if (this.isSubperformance()) supertypes.push("subperformance");
        if (this.isEnclosedPerformance()) supertypes.push("enclosedPerformance");

        return supertypes;
    }

    override defaultSupertype(): string {
        return "base";
    }

    isCheckedConstraint(): boolean {
        if (!this.isComposite) return false;

        const parent = this.parent();
        return parent.isAny([ItemDefinition, ItemUsage]);
    }

    override self(): ConstraintUsage | undefined {
        return super.self() as ConstraintUsage;
    }

    override parent(): ModelContainer<ConstraintUsage> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface ConstraintUsage {
        $meta: ConstraintUsageMeta;
    }
}
