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

import { AstNode, AstNodeHoverProvider, getDocument, MaybePromise } from "langium";
import { Hover } from "vscode-languageserver";
import { Utils } from "vscode-uri";
import { isAlias, isElement, isType } from "../../generated/ast";

export class SysMLHoverProvider extends AstNodeHoverProvider {
    protected override getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined> {
        if (!isElement(node)) return;
        let content = `#### \`${node.$meta.qualifiedName}\`
\`${node.$type}\` in \`${Utils.basename(getDocument(node).uri)}\`  
`;

        // use docs from the first specialization that has them
        let docs = node.$meta.docs;
        if (docs.length === 0) {
            if (isAlias(node)) {
                const target = node.$meta.for.target?.node;
                if (target) {
                    content += `Alias for \`${target.$meta.qualifiedName}\`\n`;
                    docs = target.$meta.docs;
                    node = target;
                }
            }

            if (isType(node)) {
                for (const type of node.$meta.allTypes()) {
                    docs = type.$meta.docs;
                    if (docs.length > 0) break;
                }
            }
        }

        if (docs.length > 0) {
            content += "\n";
            content += docs.map((doc) => doc.$meta.body).join("\n\n");
        }

        if (content) {
            return {
                contents: {
                    kind: "markdown",
                    value: content,
                },
            };
        }
        return undefined;
    }
}
