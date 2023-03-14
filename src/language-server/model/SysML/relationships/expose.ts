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

import { Expose } from "../../../generated/ast";
import { Importable, ImportMeta } from "../../KerML/relationships/import";
import { metamodelOf, ElementID, ModelContainer } from "../../metamodel";

@metamodelOf(Expose, "abstract")
export abstract class ExposeMeta<T extends Importable = Importable> extends ImportMeta<T> {
    constructor(id: ElementID, parent: ModelContainer<Expose>) {
        super(id, parent);
    }

    override initialize(_: Expose): void {
        this.importsAll = true;
    }

    override ast(): Expose | undefined {
        return this._ast as Expose;
    }

    override parent(): ModelContainer<Expose> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface Expose {
        $meta: ExposeMeta;
    }
}
