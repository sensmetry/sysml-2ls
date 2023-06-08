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

import { AssignmentActionUsage } from "../../generated/ast";
import { NonNullable, enumerable } from "../../utils";
import { ElementParts, FeatureMeta, MembershipMeta, ParameterMembershipMeta } from "../KerML";
import { metamodelOf } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";
import { ReferenceUsageMeta } from "./reference-usage";
import { UsageMeta } from "./usage";

@metamodelOf(AssignmentActionUsage, {
    base: "Actions::assignmentActions",
    subaction: "Actions::Action::assignments",
    featureWrite: "Actions::AssignmentAction",
})
export class AssignmentActionUsageMeta extends ActionUsageMeta {
    // Langium cannot parse this...
    private _target?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;
    private _targetMember?: MembershipMeta<FeatureMeta> | undefined;
    private _assignedValue?: ParameterMembershipMeta<UsageMeta> | undefined;

    @enumerable
    public get target(): ParameterMembershipMeta<ReferenceUsageMeta> | undefined {
        return this._target;
    }
    public set target(value: ParameterMembershipMeta<ReferenceUsageMeta> | undefined) {
        this._target = value;
    }

    @enumerable
    public get targetMember(): MembershipMeta<FeatureMeta> | undefined {
        return this._targetMember;
    }
    public set targetMember(value: MembershipMeta<FeatureMeta>) {
        this._targetMember = value;
    }

    @enumerable
    public get assignedValue(): ParameterMembershipMeta<UsageMeta> | undefined {
        return this._assignedValue;
    }
    public set assignedValue(value: ParameterMembershipMeta<UsageMeta>) {
        this._assignedValue = value;
    }

    override ast(): AssignmentActionUsage | undefined {
        return this._ast as AssignmentActionUsage;
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = super.featureMembers();
        return (
            [this.target, this.targetMember, this.assignedValue] as (
                | MembershipMeta<FeatureMeta>
                | undefined
            )[]
        )
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    override textualParts(): ElementParts {
        const parts: ElementParts = { prefixes: this.prefixes };

        if (this.multiplicity) parts.multiplicity = [this.multiplicity];
        parts.heritage = this.heritage;

        if (this.target) parts.target = [this.target];
        if (this.targetMember) parts.targetMember = [this.targetMember];
        if (this.assignedValue) parts.assignedValue = [this.assignedValue];

        parts.children = this.children;
        return parts;
    }
}

declare module "../../generated/ast" {
    interface AssignmentActionUsage {
        $meta: AssignmentActionUsageMeta;
    }
}
