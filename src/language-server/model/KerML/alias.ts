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

import { Alias } from "../../generated/ast";
import { Target } from "../../utils/containers";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { RelationshipMeta } from "./relationship";
import { Exported } from "./_internal";

@metamodelOf(Alias)
export class AliasMeta extends RelationshipMeta {
    /**
     * Final alias target description
     */
    readonly for = new Target<Exported>();

    constructor(elementId: ElementID, parent: ModelContainer<Alias>) {
        super(elementId, parent);
    }

    override self(): Alias | undefined {
        return super.deref() as Alias;
    }

    override parent(): ModelContainer<Alias> {
        return this._parent;
    }

    override reset(_: Alias): void {
        this.for.reset();
    }
}

declare module "../../generated/ast" {
    interface Alias {
        $meta: AliasMeta;
    }
}
