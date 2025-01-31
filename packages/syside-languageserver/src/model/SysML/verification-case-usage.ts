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

import { VerificationCaseUsage, VerificationCaseDefinition } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { CaseUsageMeta, CaseUsageOptions } from "./case-usage";

export type VerificationCaseUsageOptions = CaseUsageOptions;

@metamodelOf(VerificationCaseUsage, {
    base: "VerificationCases::verificationCases",
    subVerificationCase: "VerificationCases::VerificationCase::subVerificationCases",
})
export class VerificationCaseUsageMeta extends CaseUsageMeta {
    override getSubactionType(): string | undefined {
        return this.isSubVerificationCase() ? "subVerificationCase" : super.getSubactionType();
    }

    isSubVerificationCase(): boolean {
        const parent = this.owner();
        return Boolean(
            this.isNonEntryExitComposite() &&
                parent?.isAny(VerificationCaseUsage, VerificationCaseDefinition)
        );
    }

    override ast(): VerificationCaseUsage | undefined {
        return this._ast as VerificationCaseUsage;
    }
}

declare module "../../generated/ast" {
    interface VerificationCaseUsage {
        $meta: VerificationCaseUsageMeta;
    }
}
