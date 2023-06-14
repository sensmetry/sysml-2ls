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
import { ConnectionUsage } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { ConnectorAsUsageMeta, ConnectorAsUsageOptions } from "./connector-as-usage";
import { PartUsageMeta, PartUsageOptions } from "./part-usage";
import { FeatureMeta, InheritanceMeta, MembershipMeta } from "../KerML";

export interface ConnectionUsageOptions extends PartUsageOptions, ConnectorAsUsageOptions {}

@metamodelOf(ConnectionUsage, {
    base: "Connections::connections",
    binary: "Connections::binaryConnections",
})
export class ConnectionUsageMeta extends Mixin(ConnectorAsUsageMeta, PartUsageMeta) {
    override defaultSupertype(): string {
        return this.isBinary() ? "binary" : "base";
    }

    override ast(): ConnectionUsage | undefined {
        return this._ast as ConnectionUsage;
    }

    protected override onSpecializationAdded(specialization: InheritanceMeta): void {
        this.resetEnds();
        PartUsageMeta.prototype["onSpecializationAdded"].call(this, specialization);
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        return ConnectorAsUsageMeta.prototype.featureMembers.call(this);
    }
}

declare module "../../generated/ast" {
    interface ConnectionUsage {
        $meta: ConnectionUsageMeta;
    }
}
