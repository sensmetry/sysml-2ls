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

import { PartDefinition, PortDefinition, PortUsage } from "../../generated/ast";
import { enumerable } from "../../utils/common";
import { metamodelOf } from "../metamodel";
import { OccurrenceUsageMeta, OccurrenceUsageOptions } from "./occurrence-usage";

export type PortUsageOptions = OccurrenceUsageOptions;

@metamodelOf(PortUsage, {
    base: "Ports::ports",
    ownedPort: "Parts::Part::ownedPorts",
    subport: "Ports::Port::subports",
})
export class PortUsageMeta extends OccurrenceUsageMeta {
    @enumerable
    override get isComposite(): boolean {
        return this.owningType?.isAny(PortDefinition, PortUsage) ? super.isComposite : false;
    }
    override set isComposite(value) {
        super.isComposite = value;
    }

    override defaultSupertype(): string {
        if (this.isOwnedPort()) return "ownedPort";
        if (this.isSubport()) return "subport";
        return "base";
    }

    isOwnedPort(): boolean {
        return Boolean(this.isComposite && this.owner()?.isAny(PartDefinition, PortUsage));
    }

    isSubport(): boolean {
        return Boolean(this.isComposite && this.owner()?.isAny(PortDefinition, PortUsage));
    }

    override ast(): PortUsage | undefined {
        return this._ast as PortUsage;
    }
}

declare module "../../generated/ast" {
    interface PortUsage {
        $meta: PortUsageMeta;
    }
}
