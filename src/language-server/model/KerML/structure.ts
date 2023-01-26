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

import { Classifier, Structure } from "../../generated/ast";
import { TypeClassifier } from "../enums";
import { metamodelOf, ElementID } from "../metamodel";
import { ClassMeta } from "./class";

export const ImplicitStructures = {
    base: "Objects::Object",
};

@metamodelOf(Structure, ImplicitStructures)
export class StructureMeta extends ClassMeta {
    constructor(node: Structure, id: ElementID) {
        super(node, id);
    }

    protected override setupClassifiers(node: Classifier): void {
        super.setupClassifiers(node);
        this.classifier = TypeClassifier.Structure;
    }

    override self(): Structure {
        return super.deref() as Structure;
    }
}

declare module "../../generated/ast" {
    interface Structure {
        $meta: StructureMeta;
    }
}
