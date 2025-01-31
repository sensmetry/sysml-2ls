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

import { ItemFlow, Step } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { FeatureMeta, FeatureOptions } from "./_internal";

export const ImplicitSteps = {
    base: "Performances::performances",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
    incomingTransfer: "Occurrences::Occurrence::incomingTransfers",
    featureWrite: "FeatureReferencingPerformances::FeatureWritePerformance", // TODO
};

export type StepOptions = FeatureOptions;

@metamodelOf(Step, ImplicitSteps)
export class StepMeta extends FeatureMeta {
    override ast(): Step | undefined {
        return this._ast as Step;
    }

    override defaultSupertype(): string {
        if (this.isStructureOwnedComposite()) return "ownedPerformance";
        if (this.isBehaviorOwnedComposite()) return "subperformance";
        if (this.isBehaviorOwned()) return "enclosedPerformance";
        if (this.isIncomingTransfer()) return "incomingTransfer";
        return "base";
    }

    protected isIncomingTransfer(): boolean {
        const parent = this.owner();
        if (!parent?.is(ItemFlow)) return false;
        return Boolean(parent.item);
    }
}

declare module "../../generated/ast" {
    interface Step {
        $meta: StepMeta;
    }
}
