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

import { stream } from "langium";
import { FeatureMeta, MembershipMeta, NamespaceMeta, TypeMeta } from "../KerML/_internal";

export class PositionalFeaturesBase {
    private _owned: FeatureMeta[] | undefined = undefined;
    private _all: FeatureMeta[] | undefined = undefined;

    /**
     * @returns directly owned features
     */
    owned(self: NamespaceMeta, filter: (f: MembershipMeta<FeatureMeta>) => boolean): FeatureMeta[] {
        if (this._owned === undefined) {
            this._owned = stream(self.featureMembers())
                .filter(filter)
                .map((m) => m.element())
                .nonNullable()
                .toArray();
        }

        return this._owned;
    }

    /**
     * @returns directly owned and inherited features
     */
    all(
        self: TypeMeta,
        filter: (f: MembershipMeta<FeatureMeta>) => boolean,
        typeFilter?: (t: TypeMeta) => boolean
    ): FeatureMeta[] {
        if (this._all === undefined) {
            this._all = self
                .basePositionalFeatures(filter, typeFilter, true)
                .map((m) => m.element())
                .nonNullable()
                .toArray();
        }

        return this._all;
    }

    clearCaches(): void {
        this._owned = undefined;
        this._all = undefined;
    }
}
