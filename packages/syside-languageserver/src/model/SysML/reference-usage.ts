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

import { LangiumDocument } from "langium";
import { ReferenceUsage, TransitionUsage } from "../../generated/ast";
import { enumerable } from "../../utils/common";
import { Edge, ParameterMembershipMeta } from "../KerML";
import { ElementIDProvider, GeneralType, metamodelOf } from "../metamodel";
import { UsageMeta, UsageOptions } from "./usage";

export type ReferenceUsageOptions = UsageOptions;

// TODO: Redefinitions

@metamodelOf(ReferenceUsage)
export class ReferenceUsageMeta extends UsageMeta {
    @enumerable
    override get isComposite(): boolean {
        return false;
    }
    override set isComposite(value) {
        // empty
    }

    override defaultGeneralTypes(): GeneralType[] {
        const owner = this.owner();
        if (owner?.is(TransitionUsage) && this === owner.payloadParameter()) return [];
        const supertypes = super.defaultGeneralTypes();

        return supertypes;
    }

    override ast(): ReferenceUsage | undefined {
        return this._ast as ReferenceUsage;
    }
}

declare module "../../generated/ast" {
    interface ReferenceUsage {
        $meta: ReferenceUsageMeta;
    }
}

export function createEmptyParameterMember(
    provider: ElementIDProvider,
    document: LangiumDocument
): Edge<ParameterMembershipMeta, ReferenceUsageMeta> {
    return [
        ParameterMembershipMeta.create(provider, document, { isImplied: true }),
        ReferenceUsageMeta.create(provider, document),
    ];
}
