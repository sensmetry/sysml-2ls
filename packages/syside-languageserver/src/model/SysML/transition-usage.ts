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
import {
    ActionDefinition,
    ActionUsage,
    StateDefinition,
    StateUsage,
    TransitionUsage,
} from "../../generated/ast";
import { NonNullable, enumerable } from "../../utils";
import {
    ElementParts,
    ExpressionMeta,
    FeatureMeta,
    MembershipMeta,
    OwningMembershipMeta,
    ParameterMembershipMeta,
} from "../KerML/_internal";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { AcceptActionUsageMeta } from "./accept-action-usage";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage";
import { ReferenceUsageMeta } from "./reference-usage";
import { TransitionFeatureMembershipMeta } from "./relationships";
import { SuccessionAsUsageMeta } from "./succession-as-usage";
import { UsageMeta } from "./usage";

// TODO: add source, accepter, guard, effect, then, else
export type TransitionUsageOptions = ActionUsageOptions;

@metamodelOf(TransitionUsage, {
    base: "Actions::transitionActions",
    actionTransition: "Actions::Action::decisionTransitions",
    stateTransition: "States::StateAction::stateTransitions",
})
export class TransitionUsageMeta extends ActionUsageMeta {
    private _source?: MembershipMeta<FeatureMeta> | undefined;
    private _transitionLinkSource: ParameterMembershipMeta<UsageMeta>;
    private _payload: ParameterMembershipMeta<UsageMeta>;
    private _accepter?: TransitionFeatureMembershipMeta<AcceptActionUsageMeta> | undefined;
    private _guard?: TransitionFeatureMembershipMeta<ExpressionMeta> | undefined;
    private _effect?: TransitionFeatureMembershipMeta<ActionUsageMeta> | undefined;
    private _then?: OwningMembershipMeta<SuccessionAsUsageMeta> | undefined;
    private _else?: OwningMembershipMeta<SuccessionAsUsageMeta> | undefined;

    @enumerable
    public get source(): MembershipMeta<FeatureMeta> | undefined {
        return this._source;
    }
    public set source(value: MembershipMeta<FeatureMeta> | undefined) {
        this._source = value;
    }

    public get transitionLinkSource(): ParameterMembershipMeta<UsageMeta> {
        return this._transitionLinkSource;
    }

    public get payload(): ParameterMembershipMeta<UsageMeta> | undefined {
        return this._accepter ? this._payload : undefined;
    }

    @enumerable
    public get accepter(): TransitionFeatureMembershipMeta<AcceptActionUsageMeta> | undefined {
        return this._accepter;
    }
    public set accepter(value: TransitionFeatureMembershipMeta<AcceptActionUsageMeta> | undefined) {
        this._accepter = value;
    }

    @enumerable
    public get guard(): TransitionFeatureMembershipMeta<ExpressionMeta> | undefined {
        return this._guard;
    }
    public set guard(value: TransitionFeatureMembershipMeta<ExpressionMeta> | undefined) {
        this._guard = value;
    }

    @enumerable
    public get effect(): TransitionFeatureMembershipMeta<ActionUsageMeta> | undefined {
        return this._effect;
    }
    public set effect(value: TransitionFeatureMembershipMeta<ActionUsageMeta> | undefined) {
        this._effect = value;
    }

    @enumerable
    public get then(): OwningMembershipMeta<SuccessionAsUsageMeta> | undefined {
        return this._then;
    }
    public set then(value: OwningMembershipMeta<SuccessionAsUsageMeta> | undefined) {
        this._then = value;
    }

    @enumerable
    public get else(): OwningMembershipMeta<SuccessionAsUsageMeta> | undefined {
        return this._else;
    }
    public set else(value: OwningMembershipMeta<SuccessionAsUsageMeta> | undefined) {
        this._else = value;
    }

    override defaultSupertype(): string {
        if (this.isStateTransition()) return "stateTransition";
        if (this.isActionTransition()) return "actionTransition";
        return "base";
    }

    isActionTransition(): boolean {
        if (!this.isComposite) return false;
        const parent = this.owner();
        return Boolean(parent?.isAny(ActionUsage, ActionDefinition));
    }

    isStateTransition(): boolean {
        if (!this.isComposite) return false;
        const parent = this.owner();
        return Boolean(parent?.isAny(StateDefinition, StateUsage));
    }

    override ast(): TransitionUsage | undefined {
        return this._ast as TransitionUsage;
    }
    payloadParameter(): FeatureMeta | undefined {
        return this.payload?.element();
    }

    triggerActions(): AcceptActionUsageMeta | undefined {
        return this.accepter?.element();
    }

    accepterPayloadParameter(): FeatureMeta | undefined {
        return this.accepter?.element()?.payload?.element();
    }

    transitionLinkFeature(): FeatureMeta | undefined {
        return this.transitionLinkSource.element();
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = super.featureMembers();
        return (
            [
                this.source,
                this.transitionLinkSource,
                this.payload,
                this.accepter,
                this.guard,
                this.effect,
                this.then,
                this.else,
            ] as (MembershipMeta<FeatureMeta> | undefined)[]
        )
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        for (const kw of [
            "source",
            "transitionLinkSource",
            "payload",
            "accepter",
            "guard",
            "effect",
            "then",
            "else",
        ] as const) {
            const value = this[kw];
            if (value) parts.push([kw, [value]]);
        }
    }

    protected static applyTransitionOptions(
        _model: TransitionUsageMeta,
        _options: TransitionUsageOptions
    ): void {
        // empty
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: TransitionUsageOptions
    ): T["$meta"] {
        const usage = super.create(provider, document, options) as TransitionUsageMeta;
        if (options) TransitionUsageMeta.applyTransitionOptions(usage, options);

        for (const prop of ["_transitionLinkSource", "_payload"] as const) {
            const target = ReferenceUsageMeta.create(provider, document);
            const member = ParameterMembershipMeta.create(provider, document, { target });

            (usage[prop] as ParameterMembershipMeta) = member;
            usage.takeOwnership(member);
        }

        return usage;
    }
}

declare module "../../generated/ast" {
    interface TransitionUsage {
        $meta: TransitionUsageMeta;
    }
}
