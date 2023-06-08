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

import { mix } from "ts-mixer";
import { MembershipExpose } from "../../../generated/ast";
import { MembershipMeta } from "../../KerML/relationships/membership";
import { MembershipImportMeta } from "../../KerML/relationships/membership-import";
import { metamodelOf } from "../../metamodel";
import { ExposeMeta } from "./expose";

export interface MembershipExposeMeta<T extends MembershipMeta = MembershipMeta>
    extends ExposeMeta<T>,
        MembershipImportMeta<T> {
    get importsAll(): boolean;
}

@metamodelOf(MembershipExpose)
@mix(ExposeMeta, MembershipImportMeta)
// eslint-disable-next-line unused-imports/no-unused-vars
export class MembershipExposeMeta<T extends MembershipMeta = MembershipMeta> {
    ast(): MembershipExpose | undefined {
        return this._ast as MembershipExpose;
    }
}

declare module "../../../generated/ast" {
    interface MembershipExpose {
        $meta: MembershipExposeMeta;
    }
}
