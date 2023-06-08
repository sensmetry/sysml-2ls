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

import { Import } from "../../../generated/ast";
import { enumerable } from "../../../utils";
import { metamodelOf } from "../../metamodel";
import { MembershipMeta, NamespaceMeta, RelationshipMeta } from "../_internal";

export type Importable = MembershipMeta | NamespaceMeta;

@metamodelOf(Import, "abstract")
export abstract class ImportMeta<T extends Importable = Importable> extends RelationshipMeta<T> {
    isRecursive = false;

    /**
     * Whether visibility is ignored
     */
    protected _importsAll = false;

    @enumerable
    get importsAll(): boolean {
        return this._importsAll;
    }
    set importsAll(value) {
        this._importsAll = value;
    }

    override ast(): Import | undefined {
        return this._ast as Import;
    }

    /**
     *
     * @returns true if this import only imports a single name into a scope,
     * false otherwise
     */
    importsNameOnly(): boolean {
        return false;
    }
}

declare module "../../../generated/ast" {
    interface Import {
        $meta: ImportMeta;
    }
}
