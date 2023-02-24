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

import { ClassifierReference, TypeReference } from "../../generated/ast";
import { Target } from "../../utils/containers";
import { TypeReferenceMeta } from "./type-reference";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { Exported } from "./_internal";
import { ClassifierMeta } from "./classifier";

@metamodelOf(ClassifierReference)
export class ClassifierReferenceMeta extends TypeReferenceMeta {
    override readonly to = new Target<Exported<ClassifierMeta>>();

    constructor(id: ElementID, parent: ModelContainer<ClassifierReference>) {
        super(id, parent);
    }

    override self(): ClassifierReference | undefined {
        return super.deref() as ClassifierReference;
    }

    override parent(): ModelContainer<TypeReference> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface ClassifierReference {
        $meta: ClassifierReferenceMeta;
    }
}
