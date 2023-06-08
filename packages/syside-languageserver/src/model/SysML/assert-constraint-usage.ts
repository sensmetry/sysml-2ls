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
import { ActionDefinition, ActionUsage, AssertConstraintUsage } from "../../generated/ast";
import { InvariantMeta } from "../KerML/invariant";
import { metamodelOf } from "../metamodel";
import { ConstraintUsageMeta } from "./constraint-usage";

@metamodelOf(AssertConstraintUsage, {
    base: "Constraints::assertedConstraintChecks",
    negated: "Constraints::negatedConstraintChecks",
})
export class AssertConstraintUsageMeta extends Mixin(ConstraintUsageMeta, InvariantMeta) {
    override defaultSupertype(): string {
        return this.isNegated ? "negated" : "base";
    }

    protected override isBehaviorOwned(): boolean {
        const parent = this.owner();
        return Boolean(parent?.isAny(ActionDefinition, ActionUsage));
    }

    override ast(): AssertConstraintUsage | undefined {
        return this._ast as AssertConstraintUsage;
    }
}

declare module "../../generated/ast" {
    interface AssertConstraintUsage {
        $meta: AssertConstraintUsageMeta;
    }
}
