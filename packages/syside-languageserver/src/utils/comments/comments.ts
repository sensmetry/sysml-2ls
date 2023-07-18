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
    AstNode,
    CstNode,
    DocumentSegment,
    LeafCstNode,
    Mutable,
    assertUnreachable,
    isLeafCstNode,
    streamCst,
} from "langium";
import { distance } from "../cst-util";

export type TextCommentKind = "line" | "block";

export interface TextComment {
    // source text file info that will be all undefined in synthetic comments

    /**
     * Leaf CST node left of this comment CST node
     */
    readonly $previous?: LeafCstNode;
    /**
     * This comment CST node
     */
    readonly $cstNode?: LeafCstNode;
    /**
     * Leaft CST node right of this comment CST node
     */
    readonly $next?: LeafCstNode;
    /**
     * This comment document segment in the source file
     */
    readonly segment?: DocumentSegment;

    /**
     * AST node that precedes this comment
     */
    readonly $precedingNode?: AstNode;
    /**
     * AST node that fully encloses this comment
     */
    readonly $enclosingNode?: AstNode;
    /**
     * AST node that follows this comment
     */
    readonly $followingNode?: AstNode;

    /**
     * This comment kind
     */
    kind: TextCommentKind;
    /**
     * This comment text
     */
    text: string;
    /**
     * This comment line placement
     * * `endOfLine`: CST nodes before this comment but not after on the same
     *   line
     * * `ownLine`: no other CST nodes on the same line
     * * `remaining`: this comment is surrounded by other CST nodes on the same
     *   line
     */
    placement: "endOfLine" | "ownLine" | "remaining";
    /**
     * This comment placement relative to the attached AST element:
     * * `leading`: this comment is before the element starts
     * * `inner`: this comment is in the middle of the element
     * * `trailing`: this comment is after the element ends
     */
    localPlacement: "leading" | "inner" | "trailing";
}

export interface CstTextComment extends Omit<TextComment, "localPlacement"> {
    readonly $cstNode: LeafCstNode;
    readonly segment: DocumentSegment;
}

export interface CommentVisitor {
    /**
     * Gets comment kind
     */
    getKind(node: LeafCstNode): TextCommentKind | undefined;
    /**
     * Removes comment specific tokens, i.e. leading `//` in line comments
     */
    trim?(text: string, kind: TextCommentKind): string;
    /**
     * Comment visitor. Attach comments to tree in this method.
     * @param previous CST node directly before the comment
     * @param comment current comment, `localPlacement` should be set by this
     * visitor when attaching comments to the tree
     * @param next CST node directly after the comment
     */
    visit(comment: CstTextComment): void;
}

export function visitComments(root: CstNode, visitor: CommentVisitor): void {
    const iterator = streamCst(root).iterator();

    let previous: LeafCstNode | undefined;
    let stack: {
        comment: Mutable<CstTextComment>;
        following: boolean;
        next: boolean;
        ready: boolean;
    }[] = [];

    const path: AstNode[] = [];
    let preceding: AstNode | undefined = undefined;
    let following: AstNode | undefined = undefined;

    const onNext = (node: CstNode | undefined): void => {
        const isLeaf = node && isLeafCstNode(node);

        const ast = node?.element;
        let last = path.at(-1);
        if (last !== ast) {
            const astChanged = !node?.hidden && (!ast || !path.includes(ast));
            if (ast) {
                following = ast;
                if (ast.$container !== last) {
                    preceding = last;
                    while (ast.$container !== last && path.length > 0) {
                        path.pop();
                        last = path.at(-1);
                    }
                }
                path.push(ast);
            } else {
                path.length = 0;
                preceding = following;
                following = undefined;
            }

            if (astChanged) {
                stack.forEach((item) => {
                    // mark comment as ready to set following node
                    item.following = true;
                });
            }
        }

        if (isLeaf && node.hidden) {
            const kind = visitor.getKind(node);
            if (kind) {
                stack.push({
                    comment: {
                        $previous: previous,
                        $cstNode: node,
                        $precedingNode:
                            // only add the preceding node if it is contained by the
                            // enclosing node, or the enclosing nodes ends after the
                            // preceding node starts
                            distance(preceding?.$cstNode, node.element.$cstNode) <= 0
                                ? preceding
                                : undefined,
                        $enclosingNode: node?.element,
                        segment: {
                            offset: node.offset,
                            end: node.end,
                            length: node.length,
                            range: node.range,
                        },
                        placement: "ownLine",
                        kind: kind,
                        text: visitor.trim?.(node.text, kind) ?? node.text,
                    },
                    following: false,
                    next: false,
                    ready: false,
                });
            }
            return;
        }

        if (!node || isLeaf) {
            stack.forEach((item) => {
                const { comment } = item;
                if (item.following && !item.ready) {
                    // following node is always at the $next node or further so
                    // when this is reached, the comment is ready to be passed
                    // to the visitor
                    item.ready = true;

                    // following node only counts if it's a child of the
                    // enclosing node, i.e. it starts and ends inside of the
                    // enclosing node
                    if (distance(comment.$enclosingNode?.$cstNode, following?.$cstNode) <= 0)
                        // following is guaranteed to be the deepest node at
                        // this position since `node` is a leaf CST node
                        comment.$followingNode = following;
                }

                if (item.next) return;
                comment.$next = node;

                if (node && node.range.start.line === comment.segment.range.end.line) {
                    // there's a node on the same line after the comment ->
                    // always remaining
                    comment.placement = "remaining";
                } else if (
                    comment.$previous &&
                    comment.$previous.range.end.line === comment.segment.range.start.line
                ) {
                    // only a node before on the same line -> always endOfLine
                    comment.placement = "endOfLine";
                }
                item.next = true;
            });

            previous = node;
        }

        stack = stack.filter((item) => {
            if (!item.ready) return true;
            visitor.visit(item.comment);
            return false;
        });
    };

    let value = iterator.next();
    while (!value.done) {
        const node = value.value;
        onNext(node);
        value = iterator.next();
    }

    // need to try to visit the last node as well since it may be a comment
    onNext(undefined);
}

/**
 * Trims `SL_NOTE` in KerML and SysML syntax
 */
export function trimLineComment(text: string): string {
    return text.substring(2);
}

/**
 * Trims `ML_NOTE` in KerML and SysML syntax
 */
export function trimBlockComment(text: string): string {
    return text.substring(3, text.length - 2);
}

/**
 * Trims notes in KerML and SysML syntax
 */
export function trimComment(text: string, kind: TextCommentKind): string {
    switch (kind) {
        case "line":
            return trimLineComment(text);
        case "block":
            return trimBlockComment(text);
        default:
            assertUnreachable(kind);
    }
}

export abstract class AbstractKerMLCommentVisitor implements CommentVisitor {
    getKind(node: LeafCstNode): TextCommentKind | undefined {
        switch (node.tokenType.name) {
            case "SL_NOTE":
                return "line";
            case "ML_NOTE":
                return "block";
            default:
                return;
        }
    }

    trim(text: string, kind: TextCommentKind): string {
        return trimComment(text, kind);
    }

    abstract visit(comment: CstTextComment): void;
}
