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
import { ForLoopActionUsage } from "../../generated/ast";
import { NonNullable, enumerable } from "../../utils";
import { ElementParts, FeatureMeta, MembershipMeta, ParameterMembershipMeta } from "../KerML";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";
import { LoopActionUsageMeta, LoopActionUsageOptions } from "./loop-action-usage";
import { ReferenceUsageMeta } from "./reference-usage";

// TODO: add variable, sequence and body
export type ForLoopActionUsageOptions = LoopActionUsageOptions;

@metamodelOf(ForLoopActionUsage, {
    base: "Actions::forLoopActions",
    subaction: "Actions::Action::forLoops",
    loopVariable: "Actions::ForLoopAction::var", // TODO:
})
export class ForLoopActionUsageMeta extends LoopActionUsageMeta {
    private _variable?: ParameterMembershipMeta<ReferenceUsageMeta>;
    private _sequence?: ParameterMembershipMeta<ReferenceUsageMeta>;
    private _body?: ParameterMembershipMeta<ActionUsageMeta>;

    @enumerable
    public get variable(): ParameterMembershipMeta<ReferenceUsageMeta> | undefined {
        return this._variable;
    }
    public set variable(value: ParameterMembershipMeta<ReferenceUsageMeta>) {
        this._variable = value;
    }

    @enumerable
    public get sequence(): ParameterMembershipMeta<ReferenceUsageMeta> | undefined {
        return this._sequence;
    }
    public set sequence(value: ParameterMembershipMeta<ReferenceUsageMeta>) {
        this._sequence = value;
    }

    @enumerable
    public get body(): ParameterMembershipMeta<ActionUsageMeta> | undefined {
        return this._body;
    }
    public set body(value: ParameterMembershipMeta<ActionUsageMeta>) {
        this._body = value;
    }

    override ast(): ForLoopActionUsage | undefined {
        return this._ast as ForLoopActionUsage;
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = super.featureMembers();
        return (
            [this.variable, this.sequence, this.body] as (MembershipMeta<FeatureMeta> | undefined)[]
        )
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        if (this.variable) parts.push(["variable", [this.variable]]);
        if (this.sequence) parts.push(["sequence", [this.sequence]]);
        if (this.body) parts.push(["body", [this.body]]);
    }

    protected static applyForLoopOptions(
        _model: ForLoopActionUsageMeta,
        _options: ForLoopActionUsageOptions
    ): void {
        // empty
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ForLoopActionUsageOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as ForLoopActionUsageMeta;
        if (options) ForLoopActionUsageMeta.applyForLoopOptions(model, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface ForLoopActionUsage {
        $meta: ForLoopActionUsageMeta;
    }
}
