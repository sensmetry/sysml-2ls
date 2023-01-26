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

import { AstNode } from "langium";
import { Annotation, isTextualRepresentation } from "../../generated/ast";
import { metamodelOf, BasicMetamodel, ElementID } from "../metamodel";

@metamodelOf(Annotation)
export class AnnotationMeta extends BasicMetamodel<Annotation> {
    readonly annotates: AstNode[] = [];

    constructor(node: Annotation, id: ElementID) {
        super(node, id);
    }

    override initialize(node: Annotation): void {
        if (isTextualRepresentation(node) || node.about.length === 0) {
            this.annotates.push(node.$container);
        }
    }

    override reset(): void {
        this.annotates.length = 0;
        this.initialize(this.self());
    }

    override self(): Annotation {
        return super.self() as Annotation;
    }
}
