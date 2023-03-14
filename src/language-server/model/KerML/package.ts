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

import { Package } from "../../generated/ast";
import { ElementID, metamodelOf, ModelContainer } from "../metamodel";
import { ElementMeta, NamespaceMeta } from "./_internal";

@metamodelOf(Package)
export class PackageMeta extends NamespaceMeta {
    constructor(id: ElementID, parent: ModelContainer<Package>) {
        super(id, parent);
    }

    override ast(): Package | undefined {
        return this._ast as Package;
    }

    override parent(): ModelContainer<Package> {
        return this._parent;
    }

    override owner(): ElementMeta {
        // only namespaces are entry types
        return this._owner as ElementMeta;
    }
}

declare module "../../generated/ast" {
    interface Package {
        $meta: PackageMeta;
    }
}
