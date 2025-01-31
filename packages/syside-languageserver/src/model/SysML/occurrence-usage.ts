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

import { OccurrenceUsage } from "../../generated/ast";
import { GeneralType, metamodelOf } from "../metamodel";
import { UsageMeta, UsageOptions } from "./usage";

export type OccurrenceUsageOptions = UsageOptions;

@metamodelOf(OccurrenceUsage, {
    base: "Occurrences::occurrences",
    timeslice: "Occurrences::Occurrence::timeSlices",
    snapshot: "Occurrences::Occurrence::snapshots",
})
export class OccurrenceUsageMeta extends UsageMeta {
    override defaultGeneralTypes(): GeneralType[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isSuboccurrence()) supertypes.push("suboccurrence");
        if (this.portionKind) supertypes.push(this.portionKind);

        return supertypes;
    }

    override defaultSupertype(): string {
        return "base";
    }

    override ast(): OccurrenceUsage | undefined {
        return this._ast as OccurrenceUsage;
    }
}

declare module "../../generated/ast" {
    interface OccurrenceUsage {
        $meta: OccurrenceUsageMeta;
    }
}
