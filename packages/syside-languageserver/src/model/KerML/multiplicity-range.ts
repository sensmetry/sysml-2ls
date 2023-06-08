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

import { MultiplicityRange } from "../../generated/ast";
import { enumerable, LazyGetter } from "../../utils";
import { metamodelOf } from "../metamodel";
import { ElementParts, ExpressionMeta, MultiplicityMeta, OwningMembershipMeta } from "./_internal";

export const ImplicitMultiplicityRanges = {
    feature: "Base::naturals",
    classifier: "Base::naturals",
};

export interface Bounds {
    lower?: number;
    upper?: number;
}

@metamodelOf(MultiplicityRange, ImplicitMultiplicityRanges)
export class MultiplicityRangeMeta extends MultiplicityMeta {
    protected _bounds: Bounds | undefined | LazyGetter<Bounds | undefined> | "unset" = "unset";

    protected _range: OwningMembershipMeta<ExpressionMeta> | undefined;
    get range(): OwningMembershipMeta<ExpressionMeta> | undefined {
        return this._range;
    }
    setRange(value: OwningMembershipMeta<ExpressionMeta>): this {
        this._range = value;
        return this;
    }

    @enumerable
    get bounds(): Bounds | undefined {
        if (typeof this._bounds === "function") return (this._bounds = this._bounds());
        return this._bounds === "unset" ? undefined : this._bounds;
    }
    setBounds(value: Bounds | undefined | LazyGetter<Bounds | undefined>): this {
        this._bounds = value;
        return this;
    }

    override ast(): MultiplicityRange | undefined {
        return this._ast as MultiplicityRange;
    }

    override textualParts(): ElementParts {
        return { range: this._range ? [this._range] : [], children: this.children };
    }
}

declare module "../../generated/ast" {
    interface MultiplicityRange {
        $meta: MultiplicityRangeMeta;
    }
}
