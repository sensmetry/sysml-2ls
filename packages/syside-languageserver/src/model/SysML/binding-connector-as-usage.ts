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
import { BindingConnectorAsUsage } from "../../generated/ast";
import { BindingConnectorMeta, BindingConnectorOptions } from "../KerML/binding-connector";
import { metamodelOf } from "../metamodel";
import { ConnectorAsUsageMeta, ConnectorAsUsageOptions } from "./connector-as-usage";

export interface BindingConnectorAsUsageOptions
    extends BindingConnectorOptions,
        ConnectorAsUsageOptions {}

@metamodelOf(BindingConnectorAsUsage, {
    base: "Links::links",
    binary: "Links::selfLinks",
})
export class BindingConnectorAsUsageMeta extends Mixin(BindingConnectorMeta, ConnectorAsUsageMeta) {
    override ast(): BindingConnectorAsUsage | undefined {
        return this._ast as BindingConnectorAsUsage;
    }
}

declare module "../../generated/ast" {
    interface BindingConnectorAsUsage {
        $meta: BindingConnectorAsUsageMeta;
    }
}
