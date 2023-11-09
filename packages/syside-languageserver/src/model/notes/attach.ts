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
import { CstTextComment, TextComment, visitComments } from "../../utils";
import { BasicMetamodel } from "../metamodel";
import { ElementReference } from "../../generated/ast";
// import from utils results in a circular import...
import { AbstractKerMLCommentVisitor } from "../../utils/comments/comments";

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
        const onLeft = (left: BasicMetamodel): void => {
            if (note.$previous?.text === "{" && !right) {
                // trails prefix element but is actually inside a
                // children block
                note.localPlacement = "inner";
            } else {
                note.localPlacement = "trailing";
                target = left;
            }
        };

        const onDefaultEndOfLine = (): void => {
            if (left) {
                onLeft(left);
            } else if (right) {
                note.localPlacement = "leading";
                target = right;
            } else if (model) {
                note.localPlacement = "inner";
            }
        };

        const onOverride = (method: (note: TextComment) => BasicMetamodel | undefined): boolean => {
            const candidate = method.call(this, note);
            if (candidate) {
                target = candidate;
                return true;
            }
            return false;
        };

        switch (note.placement) {
            case "endOfLine": {
                if (onOverride(this.onEndOfLine)) break;
                onDefaultEndOfLine();
                break;
            }
            case "ownLine": {
                // own line is fairly simple, just attach one of the
                // neighbouring nodes, prefering leading, or the enclosing node
                if (onOverride(this.onOwnLine)) break;
                if (right) {
                    note.localPlacement = "leading";
                    target = right;
                } else if (left) {
                    onLeft(left);
                } else if (model) {
                    note.localPlacement = "inner";
                }
                break;
            }
            case "remaining": {
                if (onOverride(this.onRemaining)) break;
                if (left && right) {
                    // no need to scan text as `prettier` does since we have the
                    // CST nodes around the comment
                    if (comment.$next?.offset === comment.$followingNode.$cstNode?.offset) {
                        // if AST nodes match then were no gaps to the following
                        // node
                        note.localPlacement = "leading";
                        target = right;
                    } else {
                        note.localPlacement = "trailing";
                        target = left;
                    }
                } else {
                    onDefaultEndOfLine();
                }
                break;
            }
        }

        target.notes.push(note);
        this.onAttached(target, note);
    }

    // eslint-disable-next-line unused-imports/no-unused-vars
    protected onOwnLine(note: TextComment): BasicMetamodel | undefined {
        return;
    }

    // eslint-disable-next-line unused-imports/no-unused-vars
    protected onEndOfLine(note: TextComment): BasicMetamodel | undefined {
        return;
    }

    // eslint-disable-next-line unused-imports/no-unused-vars
    protected onRemaining(note: TextComment): BasicMetamodel | undefined {
        return;
    }

    protected onAttached(target: BasicMetamodel, note: TextComment): void {
        if (note.localPlacement !== "inner" || !target.is(ElementReference)) return;

        let part = note.$next?.text === "::" ? note.$previous : note.$next;

        /* istanbul ignore next */
        if (!part) return;

        let index = target.ast()?.parts.findIndex((ref) => ref.$refText === part?.text);
        /* istanbul ignore next */
        if (index === undefined || index === -1) return;
        if (index !== 0 && note.placement === "endOfLine" && part !== note.$previous) {
            index--;
            part = note.$previous;
        }
        note.label = `${index}-${part === note.$next ? "leading" : "trailing"}`;
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
