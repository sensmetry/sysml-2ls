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

import { TextualAnnotatingElement } from "../../generated/ast";
import { ElementID, metamodelOf, ModelContainer } from "../metamodel";
import { prettyAnnotationBody } from "../util";
import { AnnotatingElementMeta } from "./_internal";

@metamodelOf(TextualAnnotatingElement, "abstract")
export abstract class TextualAnnotatingMeta extends AnnotatingElementMeta {
    /**
     * Trimmed annotating element body
     */
    body = "";

    constructor(elementId: ElementID, parent: ModelContainer<TextualAnnotatingElement>) {
        super(elementId, parent);
    }

    override initialize(node: TextualAnnotatingElement): void {
        // Body may fail to parse and be left undefined so check here
        if (node.body as string | undefined) this.body = prettyAnnotationBody(node.body);
    }

    override ast(): TextualAnnotatingElement | undefined {
        return this._ast as TextualAnnotatingElement;
    }

    override parent(): ModelContainer<TextualAnnotatingElement> {
        return this._parent;
    }

    protected collectChildren(_node: TextualAnnotatingElement): void {
        /* empty */
    }
}

declare module "../../generated/ast" {
    interface TextualAnnotatingElement {
        $meta: TextualAnnotatingMeta;
    }
}
