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
import {
    ConstraintUsage,
    ItemDefinition,
    ItemUsage,
    RequirementConstraintMembership,
} from "../../generated/ast";
import { RequirementConstraintKind } from "../enums";
import { FeatureMeta } from "../KerML";
import { BooleanExpressionMeta } from "../KerML/boolean-expression";
import { metamodelOf } from "../metamodel";
import { OccurrenceUsageMeta } from "./occurrence-usage";

@metamodelOf(ConstraintUsage, {
    base: "Constraints::constraintChecks",
    checkedConstraint: "Items::Item::checkedConstraints",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
    assumption: "Requirements::RequirementCheck::assumptions",
    requirement: "Requirements::RequirementCheck::constraints",
})
export class ConstraintUsageMeta extends Mixin(BooleanExpressionMeta, OccurrenceUsageMeta) {
    override defaultGeneralTypes(): string[] {
        const supertype = this.requirementConstraintSupertype();
        const supertypes = supertype ? [supertype] : [];
        supertypes.push(...super.defaultGeneralTypes());

        if (this.isCheckedConstraint()) supertypes.push("checkedConstraint");
        if (this.isStructureOwnedComposite()) supertypes.push("ownedPerformance");
        if (this.isBehaviorOwnedComposite()) supertypes.push("subperformance");
        if (this.isBehaviorOwned()) supertypes.push("enclosedPerformance");

        return supertypes;
    }

    override defaultSupertype(): string {
        return "base";
    }

    isCheckedConstraint(): boolean {
        if (!this.isComposite) return false;

        const parent = this.owner();
        return Boolean(parent?.isAny(ItemDefinition, ItemUsage));
    }

    override ast(): ConstraintUsage | undefined {
        return this._ast as ConstraintUsage;
    }

    requirementConstraintKind(): RequirementConstraintKind | undefined {
        const parent = this.parent();
        return parent?.is(RequirementConstraintMembership) ? parent.kind : undefined;
    }

    override namingFeature(): FeatureMeta | undefined {
        return this.requirementConstraintKind()
            ? this.referencedFeature(ConstraintUsage)
            : super.namingFeature();
    }

    requirementConstraintSupertype(): string | undefined {
        return this.requirementConstraintKind();
    }
}

declare module "../../generated/ast" {
    interface ConstraintUsage {
        $meta: ConstraintUsageMeta;
    }
}
