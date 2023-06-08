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
import { SatisfyRequirementUsage } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { AssertConstraintUsageMeta } from "./assert-constraint-usage";
import { RequirementUsageMeta } from "./requirement-usage";
import { SubjectMembershipMeta } from "./relationships";
import { NonNullable, enumerable } from "../../utils";
import { ElementParts, FeatureMeta, MembershipMeta } from "../KerML";
import { OccurrenceUsageMeta } from "./occurrence-usage";

@metamodelOf(SatisfyRequirementUsage, {
    base: "Requirements::satisfiedRequirementChecks",
    negated: "Requirements::notSatisfiedRequirementChecks",
})
export class SatisfyRequirementUsageMeta extends Mixin(
    RequirementUsageMeta,
    AssertConstraintUsageMeta
) {
    private _satisfactionSubject?: SubjectMembershipMeta | undefined;

    @enumerable
    public get satisfactionSubject(): SubjectMembershipMeta | undefined {
        return this._satisfactionSubject;
    }
    public set satisfactionSubject(value: SubjectMembershipMeta | undefined) {
        this._satisfactionSubject = value;
    }

    override defaultSupertype(): string {
        return this.isNegated ? "negated" : "base";
    }

    override ast(): SatisfyRequirementUsage | undefined {
        return this._ast as SatisfyRequirementUsage;
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = OccurrenceUsageMeta.prototype.featureMembers.call(this);
        return ([this.satisfactionSubject] as (MembershipMeta<FeatureMeta> | undefined)[])
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    override textualParts(): ElementParts {
        const parts: ElementParts = { prefixes: this.prefixes, heritage: this.heritage };

        // heritage can come before multiplicity so put it later
        if (this.multiplicity) parts.multiplicity = [this.multiplicity];
        if (this.value) parts.value = [this.value];
        if (this.satisfactionSubject) parts.satisfactionSubject = [this.satisfactionSubject];

        parts.children = this.children;
        return parts;
    }
}

declare module "../../generated/ast" {
    interface SatisfyRequirementUsage {
        $meta: SatisfyRequirementUsageMeta;
    }
}
