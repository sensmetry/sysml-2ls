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

import { AstNode, LangiumDocument } from "langium";
import { FeatureTyping } from "../../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import {
    FeatureMeta,
    RelationshipMeta,
    RelationshipOptions,
    SpecializationMeta,
    TypeMeta,
} from "../_internal";

@metamodelOf(FeatureTyping)
// @ts-expect-error ignoring static inheritance error
export class FeatureTypingMeta<T extends TypeMeta = TypeMeta> extends SpecializationMeta<T> {
    override ast(): FeatureTyping | undefined {
        return this._ast as FeatureTyping;
    }

    static override create<
        T extends AstNode,
        Parent extends RelationshipMeta | FeatureMeta | undefined,
    >(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        // source is implicit
        options?: RelationshipOptions<TypeMeta, Parent, FeatureMeta>
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../../generated/ast" {
    interface FeatureTyping {
        $meta: FeatureTypingMeta;
    }
}
