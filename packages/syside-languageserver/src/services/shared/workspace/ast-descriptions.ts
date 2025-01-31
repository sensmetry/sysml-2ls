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

import {
    AstNodeDescription,
    AstNodeDescriptionProvider,
    getDocument,
    LangiumDocument,
} from "langium";
import { AstNodeLocator } from "langium/lib/workspace/ast-node-locator";
import { Element } from "../../../generated/ast";
import { SysMLSharedServices } from "../../services";

export interface SysMLNodeDescription<T extends Element = Element> extends AstNodeDescription {
    node?: T;
}

/**
 * Reimplementation of Langium AST node description provider that is
 * language-agnostic and creates descriptions based on SysML semantics
 */
export class SysMLNodeDescriptionProvider implements AstNodeDescriptionProvider {
    protected readonly astNodeLocator: AstNodeLocator;

    constructor(services: SysMLSharedServices) {
        this.astNodeLocator = services.workspace.AstNodeLocator;
    }

    /**
     * @override
     * @param node an Element
     * @param name name used to identify {@link node}
     * @param document The document containing the Element node. If omitted, it
     * is taken from the root AST node.
     */
    createDescription<T extends Element>(
        node: T,
        name: string,
        document: LangiumDocument = getDocument(node)
    ): SysMLNodeDescription<T> {
        return {
            node,
            name,
            type: node.$type,
            documentUri: document.uri,
            path: this.astNodeLocator.getAstNodePath(node),
        };
    }
}
