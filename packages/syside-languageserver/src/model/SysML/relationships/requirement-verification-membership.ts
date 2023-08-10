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

import {
    ObjectiveMembership,
    RequirementUsage,
    RequirementVerificationMembership,
    VerificationCaseDefinition,
    VerificationCaseUsage,
} from "../../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import { RequirementConstraintMembershipMeta } from "./requirement-constraint-membership";
import { RequirementUsageMeta } from "../requirement-usage";
import { AstNode, LangiumDocument } from "langium";
import { RelationshipOptionsBody } from "../../KerML";
import { RequirementDefinitionMeta } from "../requirement-definition";
import { RequirementConstraintKind } from "../../enums";

@metamodelOf(RequirementVerificationMembership)
export class RequirementVerificationMembershipMeta<
    T extends RequirementUsageMeta = RequirementUsageMeta,
> extends RequirementConstraintMembershipMeta<T> {
    override get kind(): RequirementConstraintKind {
        return "requirement";
    }
    override set kind(value: RequirementConstraintKind) {
        // empty;
    }

    override ast(): RequirementVerificationMembership | undefined {
        return this._ast as RequirementVerificationMembership;
    }

    isLegalVerification(): boolean {
        let owner = this.owner();
        if (!owner?.is(RequirementUsage) || !owner.parent()?.is(ObjectiveMembership)) return false;
        owner = owner.owner();
        return Boolean(owner?.isAny(VerificationCaseDefinition, VerificationCaseUsage));
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: RelationshipOptionsBody<
            RequirementUsageMeta,
            RequirementDefinitionMeta | RequirementUsageMeta
        >
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../../generated/ast" {
    interface RequirementVerificationMembership {
        $meta: RequirementVerificationMembershipMeta;
    }
}
