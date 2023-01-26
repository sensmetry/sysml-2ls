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

import { ViewpointUsage, isViewDefinition, isViewUsage } from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { RequirementUsageMeta } from "./requirement-usage";

@metamodelOf(ViewpointUsage, {
    base: "Views::viewpointChecks",
    satisfied: "Views::View::viewpointSatisfactions",
})
export class ViewpointUsageMeta extends RequirementUsageMeta {
    constructor(node: ViewpointUsage, id: ElementID) {
        super(node, id);
    }

    override defaultSupertype(): string {
        return this.isSatisfiedViewpoint() ? "satisfied" : "base";
    }

    isSatisfiedViewpoint(): boolean {
        const parent = this.parent();
        return isViewDefinition(parent) || isViewUsage(parent);
    }

    override self(): ViewpointUsage {
        return super.self() as ViewpointUsage;
    }
}

declare module "../../generated/ast" {
    interface ViewpointUsage {
        $meta: ViewpointUsageMeta;
    }
}
