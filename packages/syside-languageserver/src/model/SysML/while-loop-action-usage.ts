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
import { WhileLoopActionUsage } from "../../generated/ast";
import { NonNullable, enumerable } from "../../utils";
import {
    Edge,
    ElementParts,
    ExpressionMeta,
    FeatureMeta,
    MembershipMeta,
    ParameterMembershipMeta,
} from "../KerML";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";
import { LoopActionUsageMeta, LoopActionUsageOptions } from "./loop-action-usage";

export interface WhileLoopActionUsageOptions extends LoopActionUsageOptions {
    condition?: Edge<ParameterMembershipMeta, ExpressionMeta>;
    body?: Edge<ParameterMembershipMeta, ActionUsageMeta>;
    until?: Edge<ParameterMembershipMeta, ExpressionMeta>;
}

@metamodelOf(WhileLoopActionUsage, {
    base: "Actions::whileLoopActions",
    subaction: "Actions::Action::whileLoops",
})
export class WhileLoopActionUsageMeta extends LoopActionUsageMeta {
    private _condition?: ParameterMembershipMeta<ExpressionMeta> | undefined;
    private _body?: ParameterMembershipMeta<ActionUsageMeta> | undefined;
    private _until?: ParameterMembershipMeta<ExpressionMeta> | undefined;

    @enumerable
    public get condition(): ParameterMembershipMeta<ExpressionMeta> | undefined {
        return this._condition;
    }
    public set condition(value: Edge<ParameterMembershipMeta, ExpressionMeta> | undefined) {
        this._condition = this.swapEdgeOwnership(this._condition, value);
    }

    @enumerable
    public get body(): ParameterMembershipMeta<ActionUsageMeta> | undefined {
        return this._body;
    }
    public set body(value: Edge<ParameterMembershipMeta, ActionUsageMeta> | undefined) {
        this._body = this.swapEdgeOwnership(this._body, value);
    }

    @enumerable
    public get until(): ParameterMembershipMeta<ExpressionMeta> | undefined {
        return this._until;
    }
    public set until(value: Edge<ParameterMembershipMeta, ExpressionMeta> | undefined) {
        this._until = this.swapEdgeOwnership(this._until, value);
    }

    override ast(): WhileLoopActionUsage | undefined {
        return this._ast as WhileLoopActionUsage;
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = super.featureMembers();
        return (
            [this.condition, this.body, this.until] as (MembershipMeta<FeatureMeta> | undefined)[]
        )
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        if (this.condition) parts.push(["condition", [this.condition]]);
        if (this.body) parts.push(["body", [this.body]]);
        if (this.until) parts.push(["until", [this.until]]);
    }

    protected static applyWhileLoopOptions(
        model: WhileLoopActionUsageMeta,
        options: WhileLoopActionUsageOptions
    ): void {
        model.condition = options.condition;
        model.body = options.body;
        model.until = options.until;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: WhileLoopActionUsageOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as WhileLoopActionUsageMeta;
        if (options) WhileLoopActionUsageMeta.applyWhileLoopOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface WhileLoopActionUsage {
        $meta: WhileLoopActionUsageMeta;
    }
}
