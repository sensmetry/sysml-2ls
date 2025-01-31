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

import { Association, EndFeatureMembership } from "../../generated/ast";
import { FeatureMeta, MembershipMeta, TypeMeta } from "../KerML/_internal";
import { PositionalFeaturesBase } from "./positional-features";

const Filter: (f: MembershipMeta<FeatureMeta>) => boolean = (f) =>
    Boolean(f.element()?.isEnd || f.is(EndFeatureMembership));
const Types: ((t: TypeMeta) => boolean) | undefined = (t) => t.is(Association);

export class ConnectorMixin {
    private readonly endsCache = new PositionalFeaturesBase();
    /**
     * @returns directly owned end features
     */
    ownedEnds(this: TypeMeta & ConnectorMixin): FeatureMeta[] {
        return this.endsCache.owned(this, Filter);
    }

    /**
     * @returns directly owned and inherited end features
     */
    allEnds(this: TypeMeta & ConnectorMixin): FeatureMeta[] {
        return this.endsCache.all(this, Filter, Types);
    }

    protected resetEnds(): void {
        this.endsCache.clearCaches();
    }

    /**
     * @returns Total number of ends including inherited ones
     */
    totalEnds(this: TypeMeta & ConnectorMixin): number {
        return this.allEnds().length;
    }

    /**
     * Whether this Association/Connector is binary
     */
    isBinary(this: TypeMeta & ConnectorMixin): boolean {
        return this.totalEnds() === 2;
    }
}
