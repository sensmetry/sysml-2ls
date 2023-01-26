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

import { Import } from "../../generated/ast";
import { Target } from "../../utils/containers";
import { getImportKind, ImportKind } from "../enums";
import { metamodelOf, ElementID } from "../metamodel";
import { RelationshipMeta } from "./relationship";
import { SysMLNodeDescription } from "../../services/shared/workspace/ast-descriptions";

@metamodelOf(Import)
export class ImportMeta extends RelationshipMeta {
    /**
     * Import kind
     */
    kind: ImportKind = "specific";

    /**
     * Whether visibility is ignored
     */
    importsAll = false;

    /**
     * Imported description
     */
    readonly importDescription = new Target<SysMLNodeDescription>();

    constructor(node: Import, id: ElementID) {
        super(node, id);
    }

    override initialize(node: Import): void {
        this.kind = getImportKind(node.kind);
        this.importsAll = node.importsAll;
    }

    override self(): Import {
        return super.deref() as Import;
    }

    override reset(): void {
        super.reset();
        this.importDescription.reset();
    }
}

declare module "../../generated/ast" {
    interface Import {
        $meta: ImportMeta;
    }
}
