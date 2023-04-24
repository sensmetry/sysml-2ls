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

import { ViewUsage, ViewDefinition } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { PartUsageMeta } from "./part-usage";

@metamodelOf(ViewUsage, {
    base: "Views::views",
    subview: "Views::View::subviews",
})
export class ViewUsageMeta extends PartUsageMeta {
    constructor(id: ElementID, parent: ModelContainer<ViewUsage>) {
        super(id, parent);
    }

    override defaultSupertype(): string {
        return this.isSubview() ? "subview" : "base";
    }

    isSubview(): boolean {
        const parent = this.owner();
        return parent.isAny([ViewDefinition, ViewUsage]);
    }

    override ast(): ViewUsage | undefined {
        return this._ast as ViewUsage;
    }

    override parent(): ModelContainer<ViewUsage> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface ViewUsage {
        $meta: ViewUsageMeta;
    }
}
