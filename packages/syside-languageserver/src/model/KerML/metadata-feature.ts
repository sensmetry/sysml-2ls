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
import { MetadataFeature } from "../../generated/ast";
import { ElementID, ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import {
    AnnotatingElementMeta,
    AnnotatingElementOptions,
    ElementParts,
    FeatureMeta,
    FeatureOptions,
} from "./_internal";
import { Class } from "ts-mixer/dist/types/types";
import { AstNode, LangiumDocument } from "langium";

export const ImplicitMetadataFeatures = {
    base: "Metaobjects::metaobjects",
    annotatedElement: "Metaobjects::Metaobject::annotatedElement", // TODO
    baseType: "Metaobjects::SemanticMetadata::baseType", // TODO
};

export interface MetadataFeatureOptions extends FeatureOptions, AnnotatingElementOptions {}

@metamodelOf(MetadataFeature, ImplicitMetadataFeatures)
export class MetadataFeatureMeta extends Mixin(
    AnnotatingElementMeta as Class<
        [ElementID],
        AnnotatingElementMeta,
        typeof AnnotatingElementMeta
    >,
    FeatureMeta
) {
    override ast(): MetadataFeature | undefined {
        return this._ast as MetadataFeature;
    }
    override defaultSupertype(): string {
        return "base";
    }

    protected override collectDeclaration(parts: ElementParts): void {
        super.collectDeclaration(parts);
        parts.push(["about", this._annotations]);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: MetadataFeatureOptions
    ): T["$meta"] {
        const model = FeatureMeta.create.call(
            this,
            provider,
            document,
            options
        ) as MetadataFeatureMeta;
        if (options) {
            AnnotatingElementMeta.applyAnnotatingElementOptions(model, options);
        }
        return model;
    }
}

declare module "../../generated/ast" {
    interface MetadataFeature {
        $meta: MetadataFeatureMeta;
    }
}
