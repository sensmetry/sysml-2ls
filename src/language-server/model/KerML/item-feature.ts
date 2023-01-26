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

import { ItemFeature } from "../../generated/ast";
import { FeatureMeta } from "./feature";
import { metamodelOf, ElementID } from "../metamodel";
import { SpecializationKind } from "../enums";

export const ItemFeatureImplicits = {
    payload: "Transfers::Transfer::item",
};

@metamodelOf(ItemFeature, ItemFeatureImplicits)
export class ItemFeatureMeta extends FeatureMeta {
    constructor(node: ItemFeature, id: ElementID) {
        super(node, id);
    }

    override self(): ItemFeature {
        return super.deref() as ItemFeature;
    }

    override defaultSupertype(): string {
        return "payload";
    }

    override specializationKind(): SpecializationKind {
        return SpecializationKind.Redefinition;
    }
}

declare module "../../generated/ast" {
    interface ItemFeature {
        $meta: ItemFeatureMeta;
    }
}
