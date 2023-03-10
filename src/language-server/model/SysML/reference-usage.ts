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

import { ReferenceUsage } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { UsageMeta } from "./usage";

// TODO: Redefinitions

@metamodelOf(ReferenceUsage)
export class ReferenceUsageMeta extends UsageMeta {
    constructor(id: ElementID, parent: ModelContainer<ReferenceUsage>) {
        super(id, parent);
    }

    override defaultGeneralTypes(): string[] {
        const supertypes = super.defaultGeneralTypes();

        // TODO: https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/blob/8e5896300809dd1bcc039e213f88210570909d51/org.omg.sysml/src/org/omg/sysml/adapter/ReferenceUsageAdapter.java#LL52C74-L52C74
        // const self = this.ast();
        // const parent = this.owner();
        // if (isTransitionUsage(parent) && )

        return supertypes;
    }

    override ast(): ReferenceUsage | undefined {
        return this._ast as ReferenceUsage;
    }

    override parent(): ModelContainer<ReferenceUsage> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface ReferenceUsage {
        $meta: ReferenceUsageMeta;
    }
}
