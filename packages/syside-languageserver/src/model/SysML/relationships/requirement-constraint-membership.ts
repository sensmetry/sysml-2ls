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
import { RequirementConstraintMembership } from "../../../generated/ast";
import { RequirementConstraintKind } from "../../enums";
import { RelationshipOptionsBody } from "../../KerML";
import { FeatureMembershipMeta } from "../../KerML/relationships/feature-membership";
import { ElementIDProvider, metamodelOf, MetatypeProto } from "../../metamodel";
import { ConstraintUsageMeta } from "../constraint-usage";
import { RequirementDefinitionMeta } from "../requirement-definition";
import { RequirementUsageMeta } from "../requirement-usage";

export interface RequirementConstraintMembershipOptions
    extends RelationshipOptionsBody<
        ConstraintUsageMeta,
        RequirementDefinitionMeta | RequirementUsageMeta
    > {
    kind?: RequirementConstraintKind;
}

@metamodelOf(RequirementConstraintMembership)
export class RequirementConstraintMembershipMeta<
    T extends ConstraintUsageMeta = ConstraintUsageMeta,
> extends FeatureMembershipMeta<T> {
    protected _kind: RequirementConstraintKind = "requirement";

    get kind(): RequirementConstraintKind {
        return this._kind;
    }
    set kind(value) {
        this._kind = value;
    }

    override ast(): RequirementConstraintMembership | undefined {
        return this._ast as RequirementConstraintMembership;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: RequirementConstraintMembershipOptions
    ): T["$meta"] {
        const model = super.create(
            provider,
            document,
            options
        ) as RequirementConstraintMembershipMeta;
        if (options?.kind) model.kind = options.kind;
        return model;
    }
}

declare module "../../../generated/ast" {
    interface RequirementConstraintMembership {
        $meta: RequirementConstraintMembershipMeta;
    }
}
