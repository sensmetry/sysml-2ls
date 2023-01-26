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
    VerificationCaseUsage,
    isVerificationCaseDefinition,
    isVerificationCaseUsage,
} from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { CaseUsageMeta } from "./case-usage";

@metamodelOf(VerificationCaseUsage, {
    base: "VerificationCases::verificationCases",
    subVerificationCase: "VerificationCases::VerificationCase::subVerificationCases",
})
export class VerificationCaseUsageMeta extends CaseUsageMeta {
    constructor(node: VerificationCaseUsage, id: ElementID) {
        super(node, id);
    }

    override getSubactionType(): string | undefined {
        return this.isSubVerificationCase() ? "subVerificationCase" : super.getSubactionType();
    }

    isSubVerificationCase(): boolean {
        const parent = this.parent();
        return isVerificationCaseDefinition(parent) || isVerificationCaseUsage(parent);
    }

    override self(): VerificationCaseUsage {
        return super.self() as VerificationCaseUsage;
    }
}

declare module "../../generated/ast" {
    interface VerificationCaseUsage {
        $meta: VerificationCaseUsageMeta;
    }
}
