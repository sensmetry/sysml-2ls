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

import { Mixin } from "ts-mixer";
import { PerformActionUsage, ReferenceSubsetting } from "../../generated/ast";
import { FeatureMeta } from "../KerML";
import { GeneralType, metamodelOf } from "../metamodel";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage";
import { EventOccurrenceUsageMeta, EventOccurrenceUsageOptions } from "./event-occurrence-usage";
import { enumerable } from "../../utils";

export interface PerformActionUsageOptions
    extends EventOccurrenceUsageOptions,
        ActionUsageOptions {}

@metamodelOf(PerformActionUsage, {
    performedAction: "Parts::Part::performedActions",
})
export class PerformActionUsageMeta extends Mixin(EventOccurrenceUsageMeta, ActionUsageMeta) {
    @enumerable
    // @ts-expect-error issue with mixins
    override get isComposite(): boolean {
        return false;
    }
    override set isComposite(value) {
        // empty
    }

    override defaultGeneralTypes(): GeneralType[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isPerformedAction()) supertypes.push("performedAction");

        return supertypes;
    }

    override ast(): PerformActionUsage | undefined {
        return this._ast as PerformActionUsage;
    }
    override namingFeature(): FeatureMeta | undefined {
        return this.types(ReferenceSubsetting).head() as FeatureMeta | undefined;
    }
}

declare module "../../generated/ast" {
    interface PerformActionUsage {
        $meta: PerformActionUsageMeta;
    }
}
