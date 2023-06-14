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

import { AstNode, LangiumDocument } from "langium";
import { AssignmentActionUsage } from "../../generated/ast";
import { NonNullable, enumerable } from "../../utils";
import { ElementParts, FeatureMeta, MembershipMeta, ParameterMembershipMeta } from "../KerML";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage";
import { ReferenceUsageMeta } from "./reference-usage";
import { UsageMeta } from "./usage";

// TODO: add target, targetMember and assignedValue
export type AssignmentActionUsageOptions = ActionUsageOptions;

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

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        if (this.target) parts.push(["target", [this.target]]);
        if (this.targetMember) parts.push(["targetMember", [this.targetMember]]);
        if (this.assignedValue) parts.push(["assignedValue", [this.assignedValue]]);
    }

    protected static applyAssignmentActionOptions(
        _model: AssignmentActionUsageMeta,
        _options: AssignmentActionUsageOptions
    ): void {
        // empty
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: AssignmentActionUsageOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as AssignmentActionUsageMeta;
        if (options) AssignmentActionUsageMeta.applyAssignmentActionOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface AssignmentActionUsage {
        $meta: AssignmentActionUsageMeta;
    }
}
