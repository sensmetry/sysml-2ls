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
import { CaseDefinition, CaseUsage, IncludeUseCaseUsage } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { PerformActionUsageMeta } from "./perform-action-usage";
import { UseCaseUsageMeta } from "./use-case-usage";

@metamodelOf(IncludeUseCaseUsage, {
    subUseCase: "UseCases::UseCase::includedUseCases",
    performedAction: "Parts::Part::performedActions",
})
export class IncludeUseCaseUsageMeta extends Mixin(UseCaseUsageMeta, PerformActionUsageMeta) {
    constructor(id: ElementID, parent: ModelContainer<IncludeUseCaseUsage>) {
        super(id, parent);
    }

    override self(): IncludeUseCaseUsage | undefined {
        return super.self() as IncludeUseCaseUsage;
    }

    override parent(): ModelContainer<IncludeUseCaseUsage> {
        return this._parent;
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isPerformedAction()) supertypes.push("performedAction");
        return supertypes;
    }

    hasRelevantSubjectParameter(): boolean {
        const parent = this.parent();
        return parent.isAny([CaseDefinition, CaseUsage]);
    }
}

declare module "../../generated/ast" {
    interface IncludeUseCaseUsage {
        $meta: IncludeUseCaseUsageMeta;
    }
}
