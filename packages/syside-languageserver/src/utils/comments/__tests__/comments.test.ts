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
    AbstractKerMLCommentVisitor,
    CstTextComment,
    trimBlockComment,
    trimComment,
    trimLineComment,
    visitComments,
} from "../comments";
import { parseKerML, recursiveObjectContaining } from "../../../testing";
import { CstNode, DeepPartial } from "langium";
import { Comment, ElementReference, Package } from "../../../generated/ast";

describe("trim", () => {
    it("should trim line comments", () => {
        expect(trimLineComment("// a comment")).toEqual(" a comment");
        expect(trimComment("// a comment", "line")).toEqual(" a comment");
    });

    it("should trim block comments", () => {
        expect(trimBlockComment("//* a block comment/n  */")).toEqual(" a block comment/n  ");
        expect(trimComment("//* a block comment/n  */", "block")).toEqual(" a block comment/n  ");
    });
});

class Visitor extends AbstractKerMLCommentVisitor {
    visit = jest.fn();
}

// somehow `DeepPartial` ignores optional properties so make all required
type TextCommentMatch = DeepPartial<Required<CstTextComment>>;

describe("visitor", () => {
    async function expectVisit(text: string, calls = 1): Promise<jest.JestMatchers<jest.Mock>> {
        const visitor = new Visitor();
        const ns = await parseKerML(text);
        visitComments(ns.value.$cstNode as CstNode, visitor);

        expect(visitor.visit).toHaveBeenCalledTimes(calls);
        return expect(visitor.visit);
    }

    describe("SL_NOTE", () => {
        it("should visit single note", async () => {
            (await expectVisit("// a comment\n")).toHaveBeenLastCalledWith(
                recursiveObjectContaining<TextCommentMatch>({
                    $previous: undefined,
                    $next: undefined,
                    segment: {
                        offset: 0,
                        end: 12,
                    },
                    kind: "line",
                    placement: "ownLine",
                    text: " a comment",
                })
            );
        });

        it("should visit end of line note", async () => {
            (await expectVisit("package P {} // a comment\n")).toHaveBeenLastCalledWith(
                recursiveObjectContaining<TextCommentMatch>({
                    $previous: {
                        text: "}",
                    },
                    $precedingNode: {
                        $type: Package,
                    },
                    segment: {
                        offset: 13,
                        end: 25,
                    },
                    kind: "line",
                    placement: "endOfLine",
                    text: " a comment",
                })
            );
        });
    });

    describe("ML_NOTE", () => {
        it("should visit single note", async () => {
            (await expectVisit("//* a comment */\n")).toHaveBeenLastCalledWith(
                recursiveObjectContaining<TextCommentMatch>({
                    $previous: undefined,
                    $next: undefined,
                    segment: {
                        offset: 0,
                        end: 16,
                    },
                    kind: "block",
                    placement: "ownLine",
                    text: " a comment ",
                })
            );
        });

        it("should visit end of line note", async () => {
            (await expectVisit("package P {} //* a comment */\n")).toHaveBeenLastCalledWith(
                recursiveObjectContaining<TextCommentMatch>({
                    $previous: {
                        text: "}",
                    },
                    $precedingNode: <Partial<Package>>{
                        $type: Package,
                        declaredName: "P",
                    },
                    $next: undefined,
                    segment: {
                        offset: 13,
                        end: 29,
                    },
                    kind: "block",
                    placement: "endOfLine",
                    text: " a comment ",
                })
            );
        });

        it("should visit inner note", async () => {
            (
                await expectVisit("package P { //* a comment */ }\npackage PP {}")
            ).toHaveBeenLastCalledWith(
                recursiveObjectContaining<TextCommentMatch>({
                    $previous: {
                        text: "{",
                    },
                    $next: {
                        text: "}",
                    },
                    $enclosingNode: <Partial<Package>>{
                        $type: Package,
                        declaredName: "P",
                    },
                    $precedingNode: undefined,
                    // $followingNode: undefined,
                    segment: {
                        offset: 12,
                        end: 28,
                    },
                    kind: "block",
                    placement: "remaining",
                    text: " a comment ",
                })
            );
        });
    });

    it("should ignore other notes for surrounding CST nodes", async () => {
        (
            await expectVisit(
                "package P { //* a comment */ //* a second comment */ }\npackage PP {}",
                2
            )
        ).toHaveBeenLastCalledWith(
            recursiveObjectContaining<TextCommentMatch>({
                $previous: {
                    text: "{",
                },
                $next: {
                    text: "}",
                },
                $enclosingNode: <Partial<Package>>{
                    $type: Package,
                    declaredName: "P",
                },
                $precedingNode: undefined,
                // $followingNode: undefined,
                segment: {
                    offset: 29,
                    end: 52,
                },
                kind: "block",
                placement: "remaining",
                text: " a second comment ",
            })
        );
    });

    it("should set following node to the deepest following node", async () => {
        (
            await expectVisit("comment //* a note */ about A /* comment */", 1)
        ).toHaveBeenLastCalledWith(
            recursiveObjectContaining<TextCommentMatch>({
                $previous: {
                    text: "comment",
                },
                $next: {
                    text: "about",
                },
                $enclosingNode: {
                    $type: Comment,
                },
                $precedingNode: undefined,
                $followingNode: {
                    $type: ElementReference,
                },
                kind: "block",
            })
        );
    });
});
