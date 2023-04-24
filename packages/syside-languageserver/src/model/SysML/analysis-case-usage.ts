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

import { AnalysisCaseDefinition, AnalysisCaseUsage } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { CaseUsageMeta } from "./case-usage";

@metamodelOf(AnalysisCaseUsage, {
    base: "AnalysisCases::analysisCases",
    subAnalysisCase: "AnalysisCases::AnalysisCase::subAnalysisCases",
})
export class AnalysisCaseUsageMeta extends CaseUsageMeta {
    constructor(id: ElementID, parent: ModelContainer<AnalysisCaseUsage>) {
        super(id, parent);
    }

    override ast(): AnalysisCaseUsage | undefined {
        return this._ast as AnalysisCaseUsage;
    }

    override parent(): ModelContainer<AnalysisCaseUsage> {
        return this._parent;
    }

    override getSubactionType(): string | undefined {
        return this.isSubAnalysisCase() ? "subAnalysisCase" : super.getSubactionType();
    }

    isSubAnalysisCase(): boolean {
        const parent = this.owner();
        return (
            this.isNonEntryExitComposite() &&
            parent.isAny([AnalysisCaseUsage, AnalysisCaseDefinition])
        );
    }
}

declare module "../../generated/ast" {
    interface AnalysisCaseUsage {
        $meta: AnalysisCaseUsageMeta;
    }
}
