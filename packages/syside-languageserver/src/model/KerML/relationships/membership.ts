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

import { Membership } from "../../../generated/ast";
import { metamodelOf } from "../../metamodel";
import { ElementMeta, RelationshipMeta } from "../_internal";

@metamodelOf(Membership)
export class MembershipMeta<T extends ElementMeta = ElementMeta> extends RelationshipMeta<T> {
    override ast(): Membership | undefined {
        return this._ast as Membership;
    }

    override get name(): string | undefined {
        return this.isAlias() ? super.name : this.element()?.name;
    }

    override get shortName(): string | undefined {
        return this.isAlias() ? super.shortName : this.element()?.shortName;
    }

    isAlias(): boolean {
        return Boolean(super.shortName || super.name);
    }
}

declare module "../../../generated/ast" {
    interface Membership {
        $meta: MembershipMeta;
    }
}
