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
 *
 * Based on prettier
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
import { distance, newLineCount } from "../cst-util";
import {
    Doc,
    breakParent,
    hardline,
    indent,
    inheritLabel,
    join,
    line,
    lineSuffix,
    literalline,
    literals,
    text,
} from "../printer/doc";
import { SemanticTokenTypes } from "vscode-languageserver";
import { getNextNode, getPreviousNode } from "../cst-util";

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
     * AST node that precedes this comment. Always an immediate child of
     * `$enclosingNode` if set.
     */
    readonly $precedingNode?: AstNode;
    /**
     * AST node that fully encloses this comment
     */
    readonly $enclosingNode?: AstNode;
    /**
     * AST node that follows this comment. Always an immediate child of
     * `$enclosingNode` if set.
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

    /**
     * Optional label that may be set during attachment to mark specific comment
     * position. May be useful for coarse ASTs.
     */
    label?: unknown;
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
        const last = path.at(-1);
        if (last !== ast) {
            const astChanged = !node?.hidden && (!ast || !path.includes(ast));
            if (ast) {
                following = ast;

                // `ast.$container` for descending and `ast` for ascending
                const ancestorIdx = path.findLastIndex(
                    (node) => node === ast.$container || node === ast
                );

                // preceding node is the last child in enclosing node scope
                if (ancestorIdx === -1) {
                    preceding = undefined;
                } else {
                    preceding = path.at(ancestorIdx + 1);
                }
                path.length = ancestorIdx + 1;
                path.push(ast);
            } else {
                path.length = 0;
                preceding = following;
                following = undefined;
            }

            if (astChanged) {
                stack.forEach((item) => {
                    const { comment } = item;
                    if (!item.following) {
                        // following node only counts if it's a child of the
                        // enclosing node, i.e. it starts and ends inside of the
                        // enclosing node
                        if (distance(comment.$enclosingNode?.$cstNode, following?.$cstNode) <= 0)
                            // following is guaranteed to be the deepest node at
                            // this position since `node` is a leaf CST node
                            comment.$followingNode = following;
                        item.following = true;
                    }
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
                // following node is always at the $next node or further so
                // when this is reached, the comment is ready to be passed
                // to the visitor
                item.ready = true;
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
            if (!item.ready || !item.following) return true;
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

const HighlightComment = { type: SemanticTokenTypes.comment };
const SL_NOTE = {
    start: text("//", HighlightComment),
};
const ML_NOTE = {
    start: text("//*", HighlightComment),
    end: text("*/", HighlightComment),
};

/**
 * Default prints KerML and SysML notes to `Doc`.
 */
export function printKerMLNote(comment: TextComment): Doc {
    if (comment.kind === "line") return [SL_NOTE.start, text(comment.text, HighlightComment)];

    const lines = comment.text.split("\n");
    const lastLine = lines.at(-1)?.trim();
    const indentable =
        lines.length > 1 &&
        lines.slice(1, lines.length - 1).every((line) => line.trimStart()[0] === "*") &&
        (lastLine?.[0] === "*" || lastLine === "");

    if (indentable) {
        return [
            ML_NOTE.start,
            join(
                [hardline, text("  ")],
                lines.map((line, index) => {
                    if (index === 0) return text(line.trimEnd(), HighlightComment);
                    if (index < lines.length - 1) return text(line.trim(), HighlightComment);
                    return text(line.trimStart(), HighlightComment);
                }),
                lastLine !== ""
            ),
            ML_NOTE.end,
        ];
    }

    return [
        ML_NOTE.start,
        join(
            literalline,
            lines.map((line) => text(line, HighlightComment))
        ),
        ML_NOTE.end,
    ];
}

export interface PrintCommentContext {
    printComment: typeof printKerMLNote;
    printed?: Set<TextComment>;
}

export function printComment(
    comment: TextComment,
    context: PrintCommentContext = { printComment: printKerMLNote }
): Doc {
    context.printed?.add(comment);
    return context.printComment(comment);
}

export function printLeadingComment(
    comment: TextComment,
    context: PrintCommentContext = { printComment: printKerMLNote }
): Doc {
    const parts = [printComment(comment, context)];

    let newLinebreaks = 0;
    if (comment.$cstNode) {
        newLinebreaks = newLineCount(comment.segment, getNextNode(comment.$cstNode, true));
    }

    if (comment.kind === "block") {
        if (newLinebreaks <= 0) parts.push(literals.space);
        else {
            let prevLinebreaks = 0;
            if (comment.$cstNode) {
                prevLinebreaks = newLineCount(
                    getPreviousNode(comment.$cstNode, true),
                    comment.segment
                );
            }
            parts.push(prevLinebreaks > 0 ? hardline : line);
        }
    } else {
        parts.push(hardline);
    }

    if (newLinebreaks > 1) parts.push(hardline);

    return parts;
}

export interface TrailingComment {
    doc: Doc;
    comment: TextComment;
    hasLineSuffix: boolean;
}

export function printTrailingComment(
    comment: TextComment,
    context: PrintCommentContext = { printComment: printKerMLNote },
    previousComment?: TrailingComment
): TrailingComment {
    const doc = printComment(comment, context);

    let prevLinebreaks = 0;
    if (comment.$cstNode) {
        prevLinebreaks = newLineCount(getPreviousNode(comment.$cstNode, true), comment.segment);
    }

    if (
        (previousComment?.hasLineSuffix && previousComment.comment.kind === "line") ||
        prevLinebreaks > 0
    ) {
        return {
            doc: lineSuffix([hardline, prevLinebreaks > 1 ? hardline : literals.emptytext, doc]),
            comment,
            hasLineSuffix: true,
        };
    }

    if (comment.kind === "line" || previousComment?.hasLineSuffix) {
        return {
            doc: [lineSuffix([literals.space, doc]), breakParent],
            comment,
            hasLineSuffix: true,
        };
    }

    return { doc: [literals.space, doc], comment, hasLineSuffix: false };
}

export function printOuterComments(
    comments: readonly TextComment[],
    context: PrintCommentContext = { printComment: printKerMLNote }
): { leading: Doc; trailing: Doc } | undefined {
    if (comments.length === 0) return;

    const leading: Doc[] = [];
    const trailing: Doc[] = [];

    let trailingComment: TrailingComment | undefined = undefined;
    comments
        .filter((comment) => !context.printed?.has(comment))
        .forEach((comment) => {
            if (comment.localPlacement === "leading") {
                leading.push(printLeadingComment(comment, context));
            } else if (comment.localPlacement === "trailing") {
                trailingComment = printTrailingComment(comment, context, trailingComment);
                trailing.push(trailingComment.doc);
            } else {
                // a logic error - catch unprinted inner comments so as not to
                // lose source file information
                throw new Error(
                    `Unprinted inner ${comment.kind} comment '${comment.text}' at ${comment.segment}`
                );
            }
        });

    if (leading.length === 0 && trailing.length === 0) return;
    return { leading, trailing };
}

export function surroundWithComments<T extends Doc>(
    doc: T,
    comments: readonly TextComment[],
    context: PrintCommentContext = { printComment: printKerMLNote }
): T | Doc[] {
    const printed = printOuterComments(comments, context);
    if (!printed) return doc;
    return inheritLabel(doc, (contents) => [printed.leading, contents, printed.trailing]);
}

export interface InnerCommentContext extends PrintCommentContext {
    indent?: boolean;
    label?: unknown;
    filter?: (comment: TextComment) => boolean;
}

const alwaysTrue = (): boolean => true;

export function printInnerComments(
    comments: readonly TextComment[],
    context: InnerCommentContext = { printComment: printKerMLNote },
    suffix?: (comment: TextComment) => Doc | undefined
): Doc {
    if (comments.length === 0) return literals.emptytext;

    const { label, filter = alwaysTrue } = context;

    const inner = comments.filter(
        (comment) =>
            comment.localPlacement === "inner" && comment.label === label && filter(comment)
    );
    const parts = inner.map((comment) => printComment(comment, context));

    if (parts.length === 0) return literals.emptytext;

    let printed: Doc = join(hardline, parts);
    if (context.indent) printed = indent(printed);
    if (suffix) {
        const ending = suffix(inner[inner.length - 1]);
        if (ending) return [printed, ending];
    }
    return printed;
}
