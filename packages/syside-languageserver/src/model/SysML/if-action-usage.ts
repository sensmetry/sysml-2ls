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

import { IfActionUsage } from "../../generated/ast";
import {
    ElementParts,
    ExpressionMeta,
    FeatureMeta,
    MembershipMeta,
    ParameterMembershipMeta,
} from "../KerML";
import { metamodelOf } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";
import { NonNullable, enumerable } from "../../utils";

@metamodelOf(IfActionUsage, {
    base: "Actions::ifThenActions",
    ifThenElse: "Actions::ifThenElseActions",
    subaction: "Actions::Action::ifSubactions",
})
export class IfActionUsageMeta extends ActionUsageMeta {
    private _condition?: ParameterMembershipMeta<ExpressionMeta>;
    private _then?: ParameterMembershipMeta<ActionUsageMeta>;
    private _else?: ParameterMembershipMeta<ActionUsageMeta>;

    @enumerable
    public get condition(): ParameterMembershipMeta<ExpressionMeta> | undefined {
        return this._condition;
    }
    public set condition(value: ParameterMembershipMeta<ExpressionMeta>) {
        this._condition = value;
    }

    @enumerable
    public get then(): ParameterMembershipMeta<ActionUsageMeta> | undefined {
        return this._then;
    }
    public set then(value: ParameterMembershipMeta<ActionUsageMeta>) {
        this._then = value;
    }

    @enumerable
    public get else(): ParameterMembershipMeta<ActionUsageMeta> | undefined {
        return this._else;
    }
    public set else(value: ParameterMembershipMeta<ActionUsageMeta> | undefined) {
        this._else = value;
    }

    override ast(): IfActionUsage | undefined {
        return this._ast as IfActionUsage;
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isIfThenElse()) supertypes.push("ifThenElse");
        return supertypes;
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = super.featureMembers();
        return ([this._condition, this._then, this._else] as MembershipMeta<FeatureMeta>[])
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    isIfThenElse(): boolean {
        return this.else !== undefined;
    }

    override textualParts(): ElementParts {
        const parts: ElementParts = {
            prefixes: this.prefixes,
        };

        if (this.multiplicity) parts.multiplicity = [this.multiplicity];

        parts.heritage = this.heritage;
        if (this.condition) parts.condition = [this.condition];
        if (this.then) parts.then = [this.then];
        if (this.else) parts.else = [this.else];
        return parts;
    }
}

declare module "../../generated/ast" {
    interface IfActionUsage {
        $meta: IfActionUsageMeta;
    }
}
