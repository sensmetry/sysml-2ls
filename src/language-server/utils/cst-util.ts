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

import { CstNode } from "langium";

export function getPreviousNode(node: CstNode, hidden = true): CstNode | undefined {
    while (node.parent) {
        const parent = node.parent;
        let index = parent.children.indexOf(node);
        while (index > 0) {
            index--;
            const previous = parent.children[index];
            if (hidden || !previous.hidden) {
                return previous;
            }
        }
        node = parent;
    }
    return undefined;
}

export function getNextNode(node: CstNode, hidden = true): CstNode | undefined {
    while (node.parent) {
        const parent = node.parent;
        let index = parent.children.indexOf(node);
        const last = parent.children.length - 1;
        while (index < last) {
            index++;
            const next = parent.children[index];
            if (hidden || !next.hidden) {
                return next;
            }
        }
        node = parent;
    }
    return undefined;
}
