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
import { AcceptActionUsage, TransitionFeatureMembership } from "../../generated/ast";
import { NonNullable, enumerable } from "../../utils";
import { Edge, ElementParts, FeatureMeta, MembershipMeta, ParameterMembershipMeta } from "../KerML";
import { ElementIDProvider, GeneralType, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage";
import { ReferenceUsageMeta } from "./reference-usage";
import { createEmptyParameterMember } from "./reference-usage";

export interface AcceptActionUsageOptions extends ActionUsageOptions {
    payload?: Edge<ParameterMembershipMeta, ReferenceUsageMeta>;
    receiver?: Edge<ParameterMembershipMeta, ReferenceUsageMeta>;
}

@metamodelOf(AcceptActionUsage, {
    base: "Actions::acceptActions",
    subactions: "Actions::Action::acceptSubactions",
})
export class AcceptActionUsageMeta extends ActionUsageMeta {
    private _defaultPayload: ParameterMembershipMeta<ReferenceUsageMeta>;
    private _defaultReceiver: ParameterMembershipMeta<ReferenceUsageMeta>;

    private _payload?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;
    private _receiver?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;

    @enumerable
    public get payload(): ParameterMembershipMeta<ReferenceUsageMeta> {
        return this._payload ?? this._defaultPayload;
    }
    public set payload(value: Edge<ParameterMembershipMeta, ReferenceUsageMeta> | undefined) {
        this._payload = this.swapEdgeOwnership(this._payload, value);
    }

    @enumerable
    public get receiver(): ParameterMembershipMeta<ReferenceUsageMeta> {
        return this._receiver ?? this._defaultReceiver;
    }
    public set receiver(value: Edge<ParameterMembershipMeta, ReferenceUsageMeta> | undefined) {
        this._receiver = this.swapEdgeOwnership(this._receiver, value);
    }

    override ast(): AcceptActionUsage | undefined {
        return this._ast as AcceptActionUsage;
    }
    override defaultGeneralTypes(): GeneralType[] {
        if (!this.isTriggerAction()) return super.defaultGeneralTypes();
        return [];
    }

    isTriggerAction(): boolean {
        const parent = this.parent();
        return Boolean(parent?.is(TransitionFeatureMembership) && parent.kind === "trigger");
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = super.featureMembers();
        return ([this.payload, this.receiver] as (MembershipMeta<FeatureMeta> | undefined)[])
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        if (this.payload) parts.push(["payload", [this.payload]]);
        if (this.receiver) parts.push(["receiver", [this.receiver]]);
    }

    protected static applyAcceptOptions(
        model: AcceptActionUsageMeta,
        provider: ElementIDProvider,
        options?: AcceptActionUsageOptions
    ): void {
        model.payload = options?.payload;
        model.receiver = options?.receiver;

        model._defaultPayload = model.swapEdgeOwnership(
            model._defaultPayload,
            createEmptyParameterMember(provider, model.document)
        );

        model._defaultReceiver = model.swapEdgeOwnership(
            model._defaultReceiver,
            createEmptyParameterMember(provider, model.document)
        );
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: AcceptActionUsageOptions
    ): T["$meta"] {
        const usage = super.create(provider, document, options) as AcceptActionUsageMeta;
        AcceptActionUsageMeta.applyAcceptOptions(usage, provider, options);
        return usage;
    }
}

declare module "../../generated/ast" {
    interface AcceptActionUsage {
        $meta: AcceptActionUsageMeta;
    }
}
