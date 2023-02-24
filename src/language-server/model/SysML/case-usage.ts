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

import { CaseDefinition, CaseUsage } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { CalculationUsageMeta } from "./calculation-usage";

@metamodelOf(CaseUsage, {
    base: "Cases::cases",
    subcase: "Cases:subcases",
})
export class CaseUsageMeta extends CalculationUsageMeta {
    constructor(id: ElementID, parent: ModelContainer<CaseUsage>) {
        super(id, parent);
    }

    override self(): CaseUsage | undefined {
        return super.self() as CaseUsage;
    }

    override parent(): ModelContainer<CaseUsage> {
        return this._parent;
    }

    override getSubactionType(): string | undefined {
        return this.isSubcase() ? "subcase" : super.getSubactionType();
    }

    isSubcase(): boolean {
        const parent = this.parent();
        return parent.isAny([CaseDefinition, CaseUsage]);
    }
}

declare module "../../generated/ast" {
    interface CaseUsage {
        $meta: CaseUsageMeta;
    }
}
