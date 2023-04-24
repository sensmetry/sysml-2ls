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

import {
    Association,
    Class,
    Classifier,
    DataType,
    Structure,
    Subclassification,
} from "../../generated/ast";
import { SysMLType } from "../../services/sysml-ast-reflection";
import { TypeClassifier } from "../enums";
import { ElementID, metamodelOf, ModelContainer } from "../metamodel";
import { TypeMeta } from "./_internal";

export const ImplicitClassifiers = {
    base: "Base::Anything",
};

@metamodelOf(Classifier, ImplicitClassifiers)
export class ClassifierMeta extends TypeMeta {
    constructor(elementId: ElementID, parent: ModelContainer<Classifier>) {
        super(elementId, parent);
    }

    override initialize(_node: Classifier): void {
        this.setupClassifiers();
    }

    protected setupClassifiers(): void {
        // if multiple of these can be true at once it means that the grammar is
        // incorrect
        if (this.is(Structure)) {
            this.classifier = TypeClassifier.Structure | TypeClassifier.Class;
            if (this.is(Association)) {
                this.classifier |= TypeClassifier.Association;
            }
        } else if (this.is(Class)) {
            this.classifier = TypeClassifier.Class;
        } else if (this.is(DataType)) {
            this.classifier = TypeClassifier.DataType;
        } else if (this.is(Association)) {
            this.classifier = TypeClassifier.Association;
        }
    }

    override ast(): Classifier | undefined {
        return this._ast as Classifier;
    }

    override parent(): ModelContainer<Classifier> {
        return this._parent;
    }

    override specializationKind(): SysMLType {
        return Subclassification;
    }
}

declare module "../../generated/ast" {
    interface Classifier {
        $meta: ClassifierMeta;
    }
}
