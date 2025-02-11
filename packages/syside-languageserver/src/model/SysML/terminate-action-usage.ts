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
import { TerminateActionUsage } from "../../generated/ast";
import { NonNullable, enumerable } from "../../utils";
import { Edge, ElementParts, FeatureMeta, MembershipMeta, ParameterMembershipMeta } from "../KerML";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage";
import { ReferenceUsageMeta } from "./reference-usage";

export interface TerminateActionUsageOptions extends ActionUsageOptions {
    terminatedOccurrence: Edge<ParameterMembershipMeta, ReferenceUsageMeta>;
}

@metamodelOf(TerminateActionUsage, {
    base: "Actions::terminateActions",
    subaction: "Actions::Action::terminateSubactions",
})
export class TerminateActionUsageMeta extends ActionUsageMeta {
    private _terminatedOccurrence?: ParameterMembershipMeta<ReferenceUsageMeta> | undefined;

    @enumerable
    public get terminatedOccurrence(): ParameterMembershipMeta<ReferenceUsageMeta> | undefined {
        return this._terminatedOccurrence;
    }
    public set terminatedOccurrence(
        value: Edge<ParameterMembershipMeta, ReferenceUsageMeta> | undefined
    ) {
        this._terminatedOccurrence = this.swapEdgeOwnership(this._terminatedOccurrence, value);
    }

    override ast(): TerminateActionUsage | undefined {
        return this._ast as TerminateActionUsage;
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        const baseFeatures = super.featureMembers();
        return ([this.terminatedOccurrence] as (MembershipMeta<FeatureMeta> | undefined)[])
            .filter(NonNullable)
            .concat(baseFeatures);
    }

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        if (this.terminatedOccurrence)
            parts.push(["terminatedOccurrence", [this.terminatedOccurrence]]);
    }

    protected static applyTerminateOptions(
        model: TerminateActionUsageMeta,
        options: TerminateActionUsageOptions
    ): void {
        model.terminatedOccurrence = options.terminatedOccurrence;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: TerminateActionUsageOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as TerminateActionUsageMeta;
        if (options) {
            TerminateActionUsageMeta.applyTerminateOptions(model, options);
        }
        return model;
    }
}

declare module "../../generated/ast" {
    interface TerminateActionUsage {
        $meta: TerminateActionUsageMeta;
    }
}
