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
import { ElementID, metamodelOf, ModelContainer } from "../../metamodel";
import { MembershipMeta, NamespaceMeta, RelationshipMeta } from "../_internal";

export type Importable = MembershipMeta | NamespaceMeta;

@metamodelOf(Import, "abstract")
export abstract class ImportMeta<T extends Importable = Importable> extends RelationshipMeta<T> {
    isRecursive = false;

    /**
     * Whether visibility is ignored
     */
    importsAll = false;

    constructor(id: ElementID, parent: ModelContainer<Import>) {
        super(id, parent);
    }

    override initialize(node: Import): void {
        this.isRecursive = !!node.isRecursive;
        this.importsAll = node.importsAll;
    }

    override ast(): Import | undefined {
        return this._ast as Import;
    }

    override parent(): ModelContainer<Import> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface Import {
        $meta: ImportMeta;
    }
}
