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

import { Redefinition } from "../../../generated/ast";
import { ElementID, metamodelOf, ModelContainer } from "../../metamodel";
import { FeatureMeta, SubsettingMeta } from "../_internal";

@metamodelOf(Redefinition)
export class RedefinitionMeta<T extends FeatureMeta = FeatureMeta> extends SubsettingMeta<T> {
    constructor(id: ElementID, parent: ModelContainer<Redefinition>) {
        super(id, parent);
    }

    override ast(): Redefinition | undefined {
        return this._ast as Redefinition;
    }

    override parent(): ModelContainer<Redefinition> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface Redefinition {
        $meta: RedefinitionMeta;
    }
}
