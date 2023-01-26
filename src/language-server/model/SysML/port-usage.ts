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

import { isPartDefinition, isPortDefinition, isPortUsage, PortUsage } from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { OccurrenceUsageMeta } from "./occurrence-usage";

@metamodelOf(PortUsage, {
    base: "Ports::ports",
    ownedPort: "Parts::Part::ownedPort",
    subport: "Ports::Port::subports",
})
export class PortUsageMeta extends OccurrenceUsageMeta {
    constructor(node: PortUsage, id: ElementID) {
        super(node, id);
    }

    override defaultSupertype(): string {
        if (this.isOwnedPort()) return "ownedPort";
        if (this.isSubport()) return "subport";
        return "base";
    }

    isOwnedPort(): boolean {
        return this.isComposite && (isPartDefinition(this.parent()) || isPortUsage(this.parent()));
    }

    isSubport(): boolean {
        return this.isComposite && (isPortDefinition(this.parent()) || isPortUsage(this.parent()));
    }

    override self(): PortUsage {
        return super.self() as PortUsage;
    }
}

declare module "../../generated/ast" {
    interface PortUsage {
        $meta: PortUsageMeta;
    }
}
