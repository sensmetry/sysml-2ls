/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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

import { Mixin } from "ts-mixer";
import { AssociationStructure } from "../../generated/ast";
import { TypeClassifier } from "../enums";
import { metamodelOf } from "../metamodel";
import { AssociationMeta, AssociationOptions, StructureMeta, StructureOptions } from "./_internal";

export const ImplicitAssociationStructures = {
    base: "Objects::LinkObject",
    binary: "Objects::BinaryLinkObject",
};

export interface AssociationStructureOptions extends StructureOptions, AssociationOptions {}

@metamodelOf(AssociationStructure, ImplicitAssociationStructures)
export class AssociationStructMeta extends Mixin(StructureMeta, AssociationMeta) {
    protected override _classifier = TypeClassifier.AssociationStruct;

    override ast(): AssociationStructure | undefined {
        return this._ast as AssociationStructure;
    }
}

declare module "../../generated/ast" {
    interface AssociationStructure {
        $meta: AssociationStructMeta;
    }
}
