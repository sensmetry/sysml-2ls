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
    TextComment,
    printInnerComments,
    printKerMLNote,
    printLeadingComment,
    printOuterComments,
    printTrailingComment,
    surroundWithComments,
    trimBlockComment,
    trimComment,
    trimLineComment,
    visitComments,
} from "../comments";
import { parseKerML, recursiveObjectContaining } from "../../../testing";
import { CstNode, DeepPartial, Mutable } from "langium";
import { Annotation, Comment, OwningMembership, Package } from "../../../generated/ast";
import { print } from "../../printer/print";
import {
    brackets,
    group,
    hardline,
    indent,
    line,
    lineSuffix,
    lineSuffixBoundary,
    literals,
    text,
} from "../../printer/doc";

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

async function expectVisit(
    text: string,
    calls?: number,
    retVal?: "matcher"
): Promise<jest.JestMatchers<jest.Mock>>;
async function expectVisit(text: string, calls: number, retVal: "mock"): Promise<jest.Mock>;
async function expectVisit(
    text: string,
    calls = 1,
    retVal: "matcher" | "mock" = "matcher"
): Promise<jest.JestMatchers<jest.Mock> | jest.Mock> {
    const visitor = new Visitor();
    const ns = await parseKerML(text);
    visitComments(ns.value.$cstNode as CstNode, visitor);

    expect(visitor.visit).toHaveBeenCalledTimes(calls);
    return retVal === "matcher" ? expect(visitor.visit) : visitor.visit;
}

describe("visitor", () => {
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
                        $type: OwningMembership,
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
                    $precedingNode: {
                        $type: OwningMembership,
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
                    $type: Annotation,
                },
                kind: "block",
            })
        );
    });
});

describe("KerML note printing", () => {
    describe("line notes", () => {
        let note: TextComment;
        beforeEach(() => {
            note = {
                kind: "line",
                localPlacement: "inner",
                placement: "endOfLine",
                text: " a note",
            };
        });

        it("should print end of line", () => {
            expect(
                print(group([lineSuffix([literals.space, printKerMLNote(note)]), text("text")]))
            ).toEqual("text // a note\n");
        });

        it("should break groups with line suffix boundary", () => {
            expect(
                print(
                    group([
                        brackets.round.open,
                        lineSuffix([literals.space, printKerMLNote(note)]),
                        lineSuffixBoundary,
                        brackets.round.close,
                    ])
                )
            ).toEqual("( // a note\n)\n");
        });
    });

    describe("block notes", () => {
        let note: TextComment;
        beforeEach(() => {
            note = {
                kind: "block",
                localPlacement: "trailing",
                placement: "endOfLine",
                text: " a note \n\n",
            };
        });

        it("should print end of line", () => {
            expect(
                print(group([lineSuffix([literals.space, printKerMLNote(note)]), text("text")]))
            ).toEqual("text //* a note \n\n*/\n");
        });

        it("should indent notes where each line starts with '*'", () => {
            note.text = " line 1   \n* line 2  ";
            expect(print(indent([hardline, printKerMLNote(note)]))).toMatchInlineSnapshot(`
"
    //* line 1
      * line 2
      */
"
`);
        });

        it("should indent notes that ends with a line break where each line starts with '*'", () => {
            note.text = " line 1   \n* line 2 \n";
            expect(print(indent([hardline, printKerMLNote(note)]))).toMatchInlineSnapshot(`
"
    //* line 1
      * line 2
      */
"
`);
        });
    });
});

describe("printing comments", () => {
    describe("leading", () => {
        describe("line comments", () => {
            it("should add an empty line if there is more than 1 line break after", async () => {
                const comments = (
                    await expectVisit("package P{}\n// a note\n\n\n\n package PP{}", 1, "mock")
                ).mock.calls.flat();
                expect(comments).toHaveLength(1);
                expect(print(printLeadingComment(comments[0]))).toEqual("// a note\n\n");
            });
        });

        describe("block comments", () => {
            it("should add a line if there's text on the same line before and a line break after", async () => {
                const comments = (
                    await expectVisit("package P{}//* a note */\n\n\n\n package PP{}", 1, "mock")
                ).mock.calls.flat();
                expect(comments).toHaveLength(1);
                expect(printLeadingComment(comments[0])).toEqual([
                    expect.anything(),
                    line,
                    hardline,
                ]);
            });

            it("should add a space if it is followed by text", async () => {
                const comments = (
                    await expectVisit("package P{}//* a note */package PP{}", 1, "mock")
                ).mock.calls.flat();
                expect(comments).toHaveLength(1);
                expect(print(printLeadingComment(comments[0]))).toEqual("//* a note */ \n");
            });
        });
    });

    describe("trailing", () => {
        describe("line", () => {
            it("should be printed as line suffix on the same line if there's no line break before", async () => {
                const comments = (
                    await expectVisit("package P{}// a note", 1, "mock")
                ).mock.calls.flat();
                expect(comments).toHaveLength(1);
                expect(print([printTrailingComment(comments[0]).doc, text("42")])).toEqual(
                    "42 // a note\n"
                );
            });

            it("should be printed as line suffix on a new line if there's a line break before", async () => {
                const comments = (
                    await expectVisit("package P{}\n// a note", 1, "mock")
                ).mock.calls.flat();
                expect(comments).toHaveLength(1);
                expect(print([printTrailingComment(comments[0]).doc, text("42")])).toEqual(
                    "42\n// a note\n"
                );
            });
        });

        describe("block", () => {
            it("should be printed with a leading space on the same line if there's no line break before", async () => {
                const comments = (
                    await expectVisit("package P{}//* a note */", 1, "mock")
                ).mock.calls.flat();
                expect(comments).toHaveLength(1);
                expect(print(printTrailingComment(comments[0]).doc)).toEqual(" //* a note */\n");
            });

            it("should add an empty line if there are multiple line breaks before", async () => {
                const comments = (
                    await expectVisit("package P{}\n\n\n\n//* a note */", 1, "mock")
                ).mock.calls.flat();
                expect(comments).toHaveLength(1);
                expect(print(printTrailingComment(comments[0]).doc)).toEqual("\n\n//* a note */\n");
            });
        });
    });

    describe("inner", () => {
        let comment: TextComment;
        beforeEach(() => {
            comment = {
                kind: "line",
                localPlacement: "inner",
                placement: "endOfLine",
                text: " a note",
                label: "label",
            };
        });

        it("should print inner comments", () => {
            expect(
                print(
                    printInnerComments(
                        [comment],
                        {
                            printComment: printKerMLNote,
                            label: comment.label,
                        },
                        () => [hardline, text("42")]
                    )
                )
            ).toEqual("// a note\n42\n");
        });

        it("should not print inner comments that don't match label", () => {
            expect(
                print(
                    printInnerComments([comment], {
                        printComment: printKerMLNote,
                        label: "--",
                    })
                )
            ).toEqual("\n");
        });

        it("should not print if no comments given", () => {
            expect(
                print(
                    printInnerComments([], {
                        printComment: printKerMLNote,
                        label: "--",
                    })
                )
            ).toEqual("\n");
        });

        it("should print indented inner comments", () => {
            expect(
                print(
                    printInnerComments([comment], {
                        printComment: printKerMLNote,
                        label: comment.label,
                        indent: true,
                    })
                )
            ).toEqual("// a note\n");
        });
    });

    describe("surrounding", () => {
        it("should print leading and trailing comments", async () => {
            const comments: Mutable<TextComment>[] = (
                await expectVisit("//* leading */package P{}\n\n\n\n// trailing", 2, "mock")
            ).mock.calls.flat();
            expect(comments).toHaveLength(2);
            comments[0].localPlacement = "leading";
            comments[1].localPlacement = "trailing";
            expect(print(surroundWithComments(text("42"), comments))).toEqual(
                "//* leading */ 42\n\n// trailing\n"
            );
        });

        it("should not print empty comments", async () => {
            expect(print(surroundWithComments(text("42"), []))).toEqual("42\n");
        });

        describe("inner", () => {
            it("should throw on unprinted inner comments", async () => {
                expect(() =>
                    printOuterComments([
                        {
                            localPlacement: "inner",
                            kind: "line",
                            placement: "remaining",
                            text: "text",
                        },
                    ])
                ).toThrow(/unprinted/i);
            });

            it("should not throw on printed inner comments", async () => {
                const comment: TextComment = {
                    localPlacement: "inner",
                    kind: "line",
                    placement: "remaining",
                    text: "text",
                };

                expect(() =>
                    printOuterComments([comment], {
                        printComment: printKerMLNote,
                        printed: new Set([comment]),
                    })
                ).not.toThrow(/unprinted/i);
            });
        });
    });
});
