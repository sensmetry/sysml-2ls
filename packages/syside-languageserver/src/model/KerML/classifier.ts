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
import { Classifier, Inheritance, Subclassification } from "../../generated/ast";
import { SubtypeKeys } from "../../services";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel";
import {
    ConjugationMeta,
    EdgeContainer,
    SubclassificationMeta,
    TypeMeta,
    TypeOptions,
} from "./_internal";

export const ImplicitClassifiers = {
    base: "Base::Anything",
};

export interface ClassifierOptions extends TypeOptions {
    heritage?: EdgeContainer<ConjugationMeta<ClassifierMeta> | SubclassificationMeta>;
}

@metamodelOf(Classifier, ImplicitClassifiers)
export class ClassifierMeta extends TypeMeta {
    override ast(): Classifier | undefined {
        return this._ast as Classifier;
    }

    override specializationKind(): SubtypeKeys<Inheritance> {
        return Subclassification;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ClassifierOptions
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../generated/ast" {
    interface Classifier {
        $meta: ClassifierMeta;
    }
}
