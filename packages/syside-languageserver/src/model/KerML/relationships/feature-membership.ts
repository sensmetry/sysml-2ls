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
import { FeatureMembership } from "../../../generated/ast";
import { ElementID, ElementIDProvider, MetatypeProto, metamodelOf, mix } from "../../metamodel";
import { FeatureMeta } from "../feature";
import { FeaturingMeta } from "./featuring";
import { OwningMembershipMeta } from "./owning-membership";
import { NamespaceMeta } from "../namespace";
import { RelationshipOptionsBody } from "../relationship";

export interface FeatureMembershipMeta<T extends FeatureMeta = FeatureMeta>
    extends OwningMembershipMeta<T>,
        FeaturingMeta<T> {}

@metamodelOf(FeatureMembership)
@mix(OwningMembershipMeta, FeaturingMeta)
// eslint-disable-next-line unused-imports/no-unused-vars
export class FeatureMembershipMeta<T extends FeatureMeta = FeatureMeta> {
    // eslint-disable-next-line unused-imports/no-unused-vars
    protected constructor(id: ElementID) {
        // empty
    }

    protected onTargetSet(previous?: T, current?: T): void {
        // needed to fix incompatibility between OwningMembershipMeta and FeaturingMeta
        OwningMembershipMeta.prototype["onTargetSet"].call(this, previous, current);
    }

    ast(): FeatureMembership | undefined {
        return this._ast as FeatureMembership;
    }

    static create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        // source is implicit
        options?: RelationshipOptionsBody<FeatureMeta, NamespaceMeta>
    ): T["$meta"] {
        return OwningMembershipMeta.create.call(this, provider, document, options);
    }
}

declare module "../../../generated/ast" {
    interface FeatureMembership {
        $meta: FeatureMembershipMeta;
    }
}
