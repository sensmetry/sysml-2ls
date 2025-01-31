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

import { OwningMembership } from "../../generated/ast";
import { FeatureMeta, MembershipMeta, TypeMeta } from "../KerML/_internal";
import { PositionalFeaturesBase } from "./positional-features";

const Filter: (f: MembershipMeta<FeatureMeta>) => boolean = (f) => {
    if (!f.is(OwningMembership)) return false;
    const dir = f.element()?.direction;
    return dir === "in" || dir === "inout";
};

export class InputParametersMixin {
    private readonly params = new PositionalFeaturesBase();
    /**
     * @returns directly owned input parameter features
     */
    ownedInputParameters(this: TypeMeta & InputParametersMixin): FeatureMeta[] {
        return this.params.owned(this, Filter);
    }

    /**
     * @returns directly owned and inherited input parameter features
     */
    inputParameters(this: TypeMeta & InputParametersMixin): FeatureMeta[] {
        return this.params.all(this, Filter);
    }

    protected resetInputParameters(): void {
        this.params.clearCaches();
    }
}
