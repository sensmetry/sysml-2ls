/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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
    Edge,
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

export interface TransitionUsageOptions extends ActionUsageOptions {
    source?: Edge<MembershipMeta, FeatureMeta>;
    transitionLinkSource?: Edge<ParameterMembershipMeta, ReferenceUsageMeta>;
    payload?: Edge<ParameterMembershipMeta, ReferenceUsageMeta>;
    accepter?: Edge<TransitionFeatureMembershipMeta, AcceptActionUsageMeta>;
    guard?: Edge<TransitionFeatureMembershipMeta, ExpressionMeta>;
    effect?: Edge<TransitionFeatureMembershipMeta, ActionUsageMeta>;
    then?: Edge<OwningMembershipMeta, SuccessionAsUsageMeta>;
    else?: Edge<OwningMembershipMeta, SuccessionAsUsageMeta>;
}

@metamodelOf(TransitionUsage, {
    base: "Actions::transitionActions",
    actionTransition: "Actions::Action::decisionTransitions",
    stateTransition: "States::StateAction::stateTransitions",
})
export class TransitionUsageMeta extends ActionUsageMeta {
    private _source?: MembershipMeta<FeatureMeta> | undefined;
    private _transitionLinkSource: ParameterMembershipMeta<ReferenceUsageMeta>;
    private _payload: ParameterMembershipMeta<ReferenceUsageMeta>;
    private _accepter?: TransitionFeatureMembershipMeta<AcceptActionUsageMeta> | undefined;
    private _guard?: TransitionFeatureMembershipMeta<ExpressionMeta> | undefined;
    private _effect?: TransitionFeatureMembershipMeta<ActionUsageMeta> | undefined;
    private _then?: OwningMembershipMeta<SuccessionAsUsageMeta> | undefined;
    private _else?: OwningMembershipMeta<SuccessionAsUsageMeta> | undefined;

    @enumerable
    public get source(): MembershipMeta<FeatureMeta> | undefined {
        return this._source;
    }
    public set source(value: Edge<MembershipMeta, FeatureMeta> | undefined) {
        this._source = this.swapEdgeOwnership(this._source, value);
    }

    public get transitionLinkSource(): ParameterMembershipMeta<ReferenceUsageMeta> {
        return this._transitionLinkSource;
    }
    // this is not optional since it will always be created implicitly and
    // shouldn't be modified interactively anyway
    public set transitionLinkSource(value: Edge<ParameterMembershipMeta, ReferenceUsageMeta>) {
        this._transitionLinkSource = this.swapEdgeOwnership(this._transitionLinkSource, value);
    }

    public get payload(): ParameterMembershipMeta<ReferenceUsageMeta> | undefined {
        return this._accepter ? this._payload : undefined;
    }
    // same non-optional as transitionLinkSource
    public set payload(value: Edge<ParameterMembershipMeta, ReferenceUsageMeta>) {
        this._payload = this.swapEdgeOwnership(this._payload, value);
    }

    @enumerable
    public get accepter(): TransitionFeatureMembershipMeta<AcceptActionUsageMeta> | undefined {
        return this._accepter;
    }
    public set accepter(
        value: Edge<TransitionFeatureMembershipMeta, AcceptActionUsageMeta> | undefined
    ) {
        this._accepter = this.swapEdgeOwnership(this._accepter, value);
        if (this._accepter) this._accepter["_kind"] = "trigger";
    }

    @enumerable
    public get guard(): TransitionFeatureMembershipMeta<ExpressionMeta> | undefined {
        return this._guard;
    }
    public set guard(value: Edge<TransitionFeatureMembershipMeta, ExpressionMeta> | undefined) {
        this._guard = this.swapEdgeOwnership(this._guard, value);
        if (this._guard) this._guard["_kind"] = "guard";
    }

    @enumerable
    public get effect(): TransitionFeatureMembershipMeta<ActionUsageMeta> | undefined {
        return this._effect;
    }
    public set effect(value: Edge<TransitionFeatureMembershipMeta, ActionUsageMeta> | undefined) {
        this._effect = this.swapEdgeOwnership(this._effect, value);
        if (this._effect) this._effect["_kind"] = "effect";
    }

    @enumerable
    public get then(): OwningMembershipMeta<SuccessionAsUsageMeta> | undefined {
        return this._then;
    }
    public set then(value: Edge<OwningMembershipMeta, SuccessionAsUsageMeta> | undefined) {
        this._then = this.swapEdgeOwnership(this._then, value);
    }

    @enumerable
    public get else(): OwningMembershipMeta<SuccessionAsUsageMeta> | undefined {
        return this._else;
    }
    public set else(value: Edge<OwningMembershipMeta, SuccessionAsUsageMeta> | undefined) {
        this._else = this.swapEdgeOwnership(this._else, value);
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
        model: TransitionUsageMeta,
        options: TransitionUsageOptions
    ): void {
        model.source = options.source;
        if (options.transitionLinkSource) model.transitionLinkSource = options.transitionLinkSource;
        if (options.payload) model.payload = options.payload;
        model.accepter = options.accepter;
        model.guard = options.guard;
        model.effect = options.effect;
        model.then = options.then;
        model.else = options.else;
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
            if (usage[prop]) continue;
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
