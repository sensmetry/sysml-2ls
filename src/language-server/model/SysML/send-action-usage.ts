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

import { SendActionUsage } from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { ActionUsageMeta } from "./action-usage";

@metamodelOf(SendActionUsage, {
    base: "Actions::sendActions",
    subaction: "Actions::Action::sendSubactions",
})
export class SendActionUsageMeta extends ActionUsageMeta {
    constructor(node: SendActionUsage, id: ElementID) {
        super(node, id);
    }

    override self(): SendActionUsage {
        return super.self() as SendActionUsage;
    }
}

declare module "../../generated/ast" {
    interface SendActionUsage {
        $meta: SendActionUsageMeta;
    }
}