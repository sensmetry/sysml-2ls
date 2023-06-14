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
import { TransitionFeatureKind, TransitionFeatureMembership } from "../../../generated/ast";
import { ExpressionMeta, RelationshipOptionsBody } from "../../KerML";
import { FeatureMembershipMeta } from "../../KerML/relationships/feature-membership";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import { ActionUsageMeta } from "../action-usage";
import { TransitionUsageMeta } from "../transition-usage";

type Transition = ActionUsageMeta | ExpressionMeta;

export interface TransitionFeatureMembershipOptions
    extends RelationshipOptionsBody<Transition, TransitionUsageMeta> {
    kind?: TransitionFeatureKind;
}

@metamodelOf(TransitionFeatureMembership)
export class TransitionFeatureMembershipMeta<
    T extends Transition = Transition
> extends FeatureMembershipMeta<T> {
    kind: TransitionFeatureKind = "trigger";

    override ast(): TransitionFeatureMembership | undefined {
        return this._ast as TransitionFeatureMembership;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: TransitionFeatureMembershipOptions
    ): T["$meta"] {
        const model = super.create(provider, document, options) as TransitionFeatureMembershipMeta;
        if (options?.kind) model.kind = options.kind;
        return model;
    }
}

declare module "../../../generated/ast" {
    interface TransitionFeatureMembership {
        $meta: TransitionFeatureMembershipMeta;
    }
}
