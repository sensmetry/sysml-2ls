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

import { Association, AssociationStructure } from "../../generated/ast";
import { AssociationMeta } from "./association";
import { metamodelOf, ElementID } from "../metamodel";
import { StructureMeta } from "./structure";
import { Mixin } from "ts-mixer";
import { TypeClassifier } from "../enums";

export const ImplicitAssociationStructures = {
    base: "Objects::LinkObject",
    binary: "Objects::BinaryLinkObject",
};

@metamodelOf(AssociationStructure, ImplicitAssociationStructures)
export class AssociationStructMeta extends Mixin(AssociationMeta, StructureMeta) {
    constructor(node: Association, elementId: ElementID) {
        super(node, elementId);
    }

    protected override setupClassifiers(_node: AssociationStructure): void {
        this.classifier = TypeClassifier.AssociationStruct;
    }

    override self(): AssociationStructure {
        return super.deref() as AssociationStructure;
    }
}

declare module "../../generated/ast" {
    interface AssociationStructure {
        $meta: AssociationStructMeta;
    }
}
