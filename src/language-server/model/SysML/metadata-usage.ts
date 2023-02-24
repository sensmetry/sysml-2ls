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

import { Mixin } from "ts-mixer";
import { MetadataUsage } from "../../generated/ast";
import { MetadataFeatureMeta } from "../KerML/metadata-feature";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { ItemUsageMeta } from "./item-usage";

@metamodelOf(MetadataUsage, {
    base: "Metadata::metadataItems",
    annotatedElement: "Metaobjects::Metaobject::annotatedElement",
    baseType: "Metaobjects::SemanticMetadata::baseType",
})
export class MetadataUsageMeta extends Mixin(MetadataFeatureMeta, ItemUsageMeta) {
    constructor(id: ElementID, parent: ModelContainer<MetadataUsage>) {
        super(id, parent);
    }

    override defaultSupertype(): string {
        return "base";
    }

    override self(): MetadataUsage | undefined {
        return super.self() as MetadataUsage;
    }

    override parent(): ModelContainer<MetadataUsage> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface MetadataUsage {
        $meta: MetadataUsageMeta;
    }
}
