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

import { AstNode, LangiumDocument } from "langium";
import { Subclassification } from "../../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import {
    ClassifierMeta,
    RelationshipMeta,
    RelationshipOptions,
    SpecializationMeta,
} from "../_internal";

@metamodelOf(Subclassification)
// @ts-expect-error ignoring static inheritance error
export class SubclassificationMeta<
    T extends ClassifierMeta = ClassifierMeta,
> extends SpecializationMeta<T> {
    override ast(): Subclassification | undefined {
        return this._ast as Subclassification;
    }

    static override create<
        T extends AstNode,
        Parent extends ClassifierMeta | RelationshipMeta | undefined,
    >(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: RelationshipOptions<ClassifierMeta, Parent, ClassifierMeta>
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../../generated/ast" {
    interface Subclassification {
        $meta: SubclassificationMeta;
    }
}
