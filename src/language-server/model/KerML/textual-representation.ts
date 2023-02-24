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

import { TextualRepresentation } from "../../generated/ast";
import { TextualAnnotatingMeta } from "./textual-annotating-element";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { AnnotationMeta } from "./annotating-element";
import { Mixin } from "ts-mixer";

@metamodelOf(TextualRepresentation)
export class TextualRepresentationMeta extends Mixin(TextualAnnotatingMeta, AnnotationMeta) {
    /**
     * Trimmed language identifier
     */
    language = "";

    constructor(elementId: ElementID, parent: ModelContainer<TextualRepresentation>) {
        super(elementId, parent);
    }

    override initialize(node: TextualRepresentation): void {
        this.language = node.language.substring(1, node.language.length - 1);
    }

    override self(): TextualRepresentation | undefined {
        return super.deref() as TextualRepresentation;
    }

    override parent(): ModelContainer<TextualRepresentation> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface TextualRepresentation {
        $meta: TextualRepresentationMeta;
    }
}
