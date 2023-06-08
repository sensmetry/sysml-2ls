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

import { UseCaseUsage, UseCaseDefinition } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { CaseUsageMeta } from "./case-usage";

@metamodelOf(UseCaseUsage, {
    base: "UseCases::useCases",
    subUseCase: "UseCases::UseCase::subUseCases",
})
export class UseCaseUsageMeta extends CaseUsageMeta {
    override getSubactionType(): string | undefined {
        return this.isSubUseCase() ? "subUseCase" : super.getSubactionType();
    }

    isSubUseCase(): boolean {
        const parent = this.owner();
        return Boolean(
            this.isNonEntryExitComposite() && parent?.isAny(UseCaseUsage, UseCaseDefinition)
        );
    }

    override ast(): UseCaseUsage | undefined {
        return this._ast as UseCaseUsage;
    }
}

declare module "../../generated/ast" {
    interface UseCaseUsage {
        $meta: UseCaseUsageMeta;
    }
}
