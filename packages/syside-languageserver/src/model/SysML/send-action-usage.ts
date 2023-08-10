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
import { SendActionUsage } from "../../generated/ast";
import { NonNullable, enumerable } from "../../utils";
import { Edge, ElementParts, FeatureMeta, MembershipMeta, ParameterMembershipMeta } from "../KerML";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage";
import { ReferenceUsageMeta } from "./reference-usage";
import { createEmptyParameterMember } from "./reference-usage";

export interface SendActionUsageOptions extends ActionUsageOptions {
    payload?: Edge<ParameterMembershipMeta, ReferenceUsageMeta>;
    sender?: Edge<ParameterMembershipMeta, ReferenceUsageMeta>;
    receiver?: Edge<ParameterMembershipMeta, ReferenceUsageMeta>;
}

@metamodelOf(SendActionUsage, {
    base: "Actions::sendActions",
    subaction: "Actions::Action::sendSubactions",
})
export class SendActionUsageMeta extends ActionUsageMeta {
    private _defaultPayload: ParameterMembershipMeta<ReferenceUsageMeta>;
    private _defaultSender: ParameterMembershipMeta<ReferenceUsageMeta>;
    private _defaultReceiver: ParameterMembershipMeta<ReferenceUsageMeta>;

    private _payload?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;
    private _sender?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;
    private _receiver?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;

    @enumerable
    public get payload(): ParameterMembershipMeta<ReferenceUsageMeta> {
        return this._payload ?? this._defaultPayload;
    }
    public set payload(value: Edge<ParameterMembershipMeta, ReferenceUsageMeta> | undefined) {
        this._payload = this.swapEdgeOwnership(this._payload, value);
    }

    @enumerable
    public get sender(): ParameterMembershipMeta<ReferenceUsageMeta> {
        return this._sender ?? this._defaultSender;
    }
    public set sender(value: Edge<ParameterMembershipMeta, ReferenceUsageMeta> | undefined) {
        this._sender = this.swapEdgeOwnership(this._sender, value);
    }

    @enumerable
    public get receiver(): ParameterMembershipMeta<ReferenceUsageMeta> {
        return this._receiver ?? this._defaultReceiver;
    }
    public set receiver(value: Edge<ParameterMembershipMeta, ReferenceUsageMeta> | undefined) {
        this._receiver = this.swapEdgeOwnership(this._receiver, value);
    }

    override ast(): SendActionUsage | undefined {
        return this._ast as SendActionUsage;
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = FeatureMeta.prototype.featureMembers.call(this);
        return (
            [this.payload, this.sender, this.receiver] as (
                | MembershipMeta<FeatureMeta>
                | undefined
            )[]
        )
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);

        if (this.payload) parts.push(["payload", [this.payload]]);
        if (this.sender) parts.push(["sender", [this.sender]]);
        if (this.receiver) parts.push(["body", [this.receiver]]);
    }

    protected static applySendOptions(
        model: SendActionUsageMeta,
        provider: ElementIDProvider,
        options?: SendActionUsageOptions
    ): void {
        model.payload = options?.payload;
        model.sender = options?.sender;
        model.receiver = options?.receiver;

        model._defaultPayload = model.swapEdgeOwnership(
            model._defaultPayload,
            createEmptyParameterMember(provider, model.document)
        );
        model._defaultSender = model.swapEdgeOwnership(
            model._defaultSender,
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
        options?: SendActionUsageOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as SendActionUsageMeta;
        SendActionUsageMeta.applySendOptions(model, provider, options);
        return model;
    }
}

declare module "../../generated/ast" {
    interface SendActionUsage {
        $meta: SendActionUsageMeta;
    }
}
