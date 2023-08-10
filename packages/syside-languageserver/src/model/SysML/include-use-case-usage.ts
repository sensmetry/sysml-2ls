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

import { Mixin } from "ts-mixer";
import {
    CaseDefinition,
    CaseUsage,
    IncludeUseCaseUsage,
    ReferenceSubsetting,
} from "../../generated/ast";
import { FeatureMeta } from "../KerML";
import { metamodelOf } from "../metamodel";
import { PerformActionUsageMeta, PerformActionUsageOptions } from "./perform-action-usage";
import { UseCaseUsageMeta, UseCaseUsageOptions } from "./use-case-usage";
import { enumerable } from "../../utils";

export interface IncludeUseCaseUsageOptions
    extends PerformActionUsageOptions,
        UseCaseUsageOptions {}

@metamodelOf(IncludeUseCaseUsage, {
    base: "UseCases::useCases",
    subUseCase: "UseCases::UseCase::includedUseCases",
    performedAction: "Parts::Part::performedActions",
})
export class IncludeUseCaseUsageMeta extends Mixin(PerformActionUsageMeta, UseCaseUsageMeta) {
    @enumerable
    // @ts-expect-error issue with mixins
    override get isComposite(): boolean {
        return false;
    }
    override set isComposite(value) {
        // empty
    }

    override ast(): IncludeUseCaseUsage | undefined {
        return this._ast as IncludeUseCaseUsage;
    }
    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isPerformedAction()) supertypes.push("performedAction");
        return supertypes;
    }

    hasRelevantSubjectParameter(): boolean {
        const parent = this.owner();
        return Boolean(parent?.isAny(CaseDefinition, CaseUsage));
    }

    override namingFeature(): FeatureMeta | undefined {
        return this.types(ReferenceSubsetting).head() as FeatureMeta | undefined;
    }
}

declare module "../../generated/ast" {
    interface IncludeUseCaseUsage {
        $meta: IncludeUseCaseUsageMeta;
    }
}
