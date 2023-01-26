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

import { isElement, isItemFeature, Step } from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { FeatureMeta } from "./feature";

export const ImplicitSteps = {
    base: "Performances::performances",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
    incomingTransfer: "Occurrences::Occurrence::incomingTransfers",
    featureWrite: "FeatureReferencingPerformances::FeatureWritePerformance", // TODO
};

@metamodelOf(Step, ImplicitSteps)
export class StepMeta extends FeatureMeta {
    constructor(node: Step, id: ElementID) {
        super(node, id);
    }

    override self(): Step {
        return super.deref() as Step;
    }

    override defaultSupertype(): string {
        if (this.isOwnedPerformance()) return "ownedPerformance";
        if (this.isSubperformance()) return "subperformance";
        if (this.isEnclosedPerformance()) return "enclosedPerformance";
        if (this.isIncomingTransfer()) return "incomingTransfer";
        return "base";
    }

    protected isIncomingTransfer(): boolean {
        const parent = this.parent();
        if (!isElement(parent)) return false;
        return parent.$meta.features.some(isItemFeature);
    }
}

declare module "../../generated/ast" {
    interface Step {
        $meta: StepMeta;
    }
}
