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
import {
    AbstractKerMLCommentVisitor,
    CstTextComment,
    TextComment,
    visitComments,
} from "../../utils";
import { BasicMetamodel } from "../metamodel";

export class KerMLCommentAttachVisitor extends AbstractKerMLCommentVisitor {
    override visit(comment: CstTextComment): void {
        const model = comment.$cstNode.element.$meta;
        if (!model) return;

        const note = comment as TextComment;

        const left = comment.$precedingNode?.$meta;
        const right = comment.$followingNode?.$meta;

        let target = model;
        // attachment is similar to prettier but we don't have to do any source
        // file scanning
        switch (note.placement) {
            case "endOfLine": {
                if (this.onEndOfLine(note)) break;
                if (left) {
                    note.localPlacement = "trailing";
                    target = left;
                } else if (right) {
                    note.localPlacement = "leading";
                    target = right;
                } else if (model) {
                    note.localPlacement = "inner";
                }
                break;
            }
            case "ownLine": {
                // own line is fairly simple, just attach one of the
                // neighbouring nodes, prefering leading, or the enclosing node
                if (this.onOwnLine(note)) break;
                if (right) {
                    note.localPlacement = "leading";
                    target = right;
                } else if (left) {
                    note.localPlacement = "trailing";
                    target = left;
                } else if (model) {
                    note.localPlacement = "inner";
                }
                break;
            }
            case "remaining": {
                if (this.onRemaining(note)) break;
                if (left && right) {
                    // no need to scan text as `prettier` does since we have the
                    // CST nodes around the comment
                    if (comment.$next?.element === comment.$followingNode) {
                        // if AST nodes match then were no gaps to the following
                        // node
                        note.localPlacement = "leading";
                        target = right;
                    } else {
                        note.localPlacement = "trailing";
                        target = left;
                    }
                } else if (left) {
                    note.localPlacement = "trailing";
                    target = left;
                } else if (right) {
                    note.localPlacement = "leading";
                    target = right;
                } else if (model) {
                    note.localPlacement = "inner";
                }
                break;
            }
        }

        target.notes.push(note);
    }

    // eslint-disable-next-line unused-imports/no-unused-vars
    protected onOwnLine(note: TextComment): boolean {
        return false;
    }

    // eslint-disable-next-line unused-imports/no-unused-vars
    protected onEndOfLine(note: TextComment): boolean {
        return false;
    }

    // eslint-disable-next-line unused-imports/no-unused-vars
    protected onRemaining(note: TextComment): boolean {
        return false;
    }
}

export function attachNotes(document: LangiumDocument): void {
    if (document.commentsAttached) return;
    const root = document.parseResult.value.$cstNode;
    if (!root) return;
    visitComments(root, new KerMLCommentAttachVisitor());
    document.commentsAttached = true;
}

export function needsHardlineAfterInnerNote(element: BasicMetamodel): boolean {
    return element.notes.findLast((note) => note.localPlacement === "inner")?.kind === "line";
}
