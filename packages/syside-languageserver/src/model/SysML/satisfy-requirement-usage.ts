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
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { AssertConstraintUsageMeta, AssertConstraintUsageOptions } from "./assert-constraint-usage";
import { RequirementUsageMeta, RequirementUsageOptions } from "./requirement-usage";
import { SubjectMembershipMeta } from "./relationships";
import { NonNullable, enumerable } from "../../utils";
import { Edge, ElementParts, FeatureMeta, MembershipMeta } from "../KerML";
import { OccurrenceUsageMeta } from "./occurrence-usage";
import { AstNode, LangiumDocument } from "langium";

export interface SatisfyRequirementUsageOptions
    extends RequirementUsageOptions,
        AssertConstraintUsageOptions {
    satisfactionSubject?: Edge<SubjectMembershipMeta>;
}

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
    public set satisfactionSubject(value: Edge<SubjectMembershipMeta> | undefined) {
        this._satisfactionSubject = this.swapEdgeOwnership(this._satisfactionSubject, value);
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

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        if (this.satisfactionSubject)
            parts.push(["satisfactionSubject", [this.satisfactionSubject]]);
    }

    protected static applySatisfyRequirementOptions(
        model: SatisfyRequirementUsageMeta,
        options: SatisfyRequirementUsageOptions
    ): void {
        model.satisfactionSubject = options.satisfactionSubject;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: SatisfyRequirementUsageOptions
    ): T["$meta"] {
        const model = AssertConstraintUsageMeta.create.call(
            this,
            provider,
            document,
            options
        ) as SatisfyRequirementUsageMeta;
        if (options) {
            SatisfyRequirementUsageMeta.applySatisfyRequirementOptions(model, options);
        }
        return model;
    }
}

declare module "../../generated/ast" {
    interface SatisfyRequirementUsage {
        $meta: SatisfyRequirementUsageMeta;
    }
}
