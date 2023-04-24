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

import { TypeReference } from "../../../generated/ast";
import { Target } from "../../../utils/containers";
import { ElementID, metamodelOf, ModelContainer } from "../../metamodel";
import { NamespaceReferenceMeta, TypeMeta } from "../_internal";

@metamodelOf(TypeReference)
export class TypeReferenceMeta extends NamespaceReferenceMeta {
    override readonly to = new Target<TypeMeta>();

    constructor(id: ElementID, parent: ModelContainer<TypeReference>) {
        super(id, parent);
    }

    override ast(): TypeReference | undefined {
        return this._ast as TypeReference;
    }

    override parent(): ModelContainer<TypeReference> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface TypeReference {
        $meta: TypeReferenceMeta;
    }
}
