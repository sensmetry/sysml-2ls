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

import { LangiumDocument } from "langium";
import { ElementReference } from "../../generated/ast";
import { Target } from "../../utils/containers";
import { metamodelOf, BasicMetamodel, ElementID, ModelContainer } from "../metamodel";
import { ElementMeta, Exported } from "./_internal";

@metamodelOf(ElementReference)
export class ElementReferenceMeta extends BasicMetamodel<ElementReference> {
    /**
     * Final reference target of this reference chain
     */
    readonly to = new Target<Exported<ElementMeta>>();

    /**
     * Found references during reference resolution even if they reference an
     * invalid type. Main use is for generating completion suggestion scopes.
     */
    readonly found: (ElementMeta | undefined)[] = [];

    /**
     * Text used to parse this reference chain
     */
    text = "";

    /**
     * Document this reference originates from
     */
    document: LangiumDocument | undefined;

    constructor(id: ElementID, parent: ModelContainer<ElementReference>) {
        super(id, parent);
    }

    override initialize(node: ElementReference): void {
        this.text = node.text ?? node.$cstNode?.text ?? "";
        this.found.length = node.chain.length;
    }

    override self(): ElementReference | undefined {
        return super.deref() as ElementReference;
    }

    override reset(_: ElementReference): void {
        this.to.reset();
        this.found.fill(undefined);
    }
}

declare module "../../generated/ast" {
    interface ElementReference {
        $meta: ElementReferenceMeta;
    }
}
