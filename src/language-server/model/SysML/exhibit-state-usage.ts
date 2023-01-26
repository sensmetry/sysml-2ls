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
import { ExhibitStateUsage } from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { PerformActionUsageMeta } from "./perform-action-usage";
import { StateUsageMeta } from "./state-usage";

@metamodelOf(ExhibitStateUsage, {
    performedAction: "Parts::Part::exhibitedStates",
})
export class ExhibitStateUsageMeta extends Mixin(StateUsageMeta, PerformActionUsageMeta) {
    constructor(node: ExhibitStateUsage, id: ElementID) {
        super(node, id);
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isPerformedAction()) supertypes.push("performedAction");
        return supertypes;
    }

    override self(): ExhibitStateUsage {
        return super.self() as ExhibitStateUsage;
    }
}

declare module "../../generated/ast" {
    interface ExhibitStateUsage {
        $meta: ExhibitStateUsageMeta;
    }
}
