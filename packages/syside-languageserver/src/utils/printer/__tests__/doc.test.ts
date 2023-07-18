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
    printDoc,
    group,
    hardline,
    align,
    text,
    line,
    breakParent,
    DefaultPrinterConfig,
    conditionalGroup,
    PrinterConfig,
    Doc,
    fill,
    join,
    dedent,
    indent,
    trim,
    softline,
    literalline,
    ifBreak,
    Group,
    lineSuffix,
    lineSuffixBoundary,
    markAsRoot,
    dedentToRoot,
} from "..";

const Options: PrinterConfig = {
    ...DefaultPrinterConfig,
    addFinalNewline: false,
};

function print(doc: Doc, options?: Partial<PrinterConfig>): string {
    const text = printDoc(doc, { ...Options, ...options }).text;
    return text;
}

describe("align", () => {
    it("should align using spaces", () => {
        expect(print(group(align(4, text("aligned"))))).toEqual("    aligned");
    });

    it("should align using text", () => {
        expect(print(group(align(text("----"), text("aligned"))))).toEqual("----aligned");
    });

    it("should replace middle spaces with tabs if printing with tabs", () => {
        expect(print(align(6, text("aligned")), { useSpaces: false })).toEqual("\t  aligned");
    });

    it("should not align the first line if it is not immediate", () => {
        expect(print(group(align(text("----"), text("aligned"), false)))).toEqual("aligned");
    });
});

describe("break parents", () => {
    it("should break the owning group", () => {
        expect(print(group([text("hello"), line, text("world"), breakParent]))).toEqual(
            "hello\nworld"
        );
    });

    it("should break from nested group", () => {
        expect(
            print(
                group([
                    text("hello"),
                    line,
                    text("world"),
                    group([text(","), line, text("nested"), breakParent]),
                ])
            )
        ).toEqual("hello\nworld,\nnested");
    });

    it("should not break child groups", () => {
        expect(
            print(
                group([
                    text("hello"),
                    line,
                    text("world"),
                    breakParent,
                    group([text(","), line, text("nested")]),
                ])
            )
        ).toEqual("hello\nworld, nested");
    });
});

describe("array", () => {
    it("should concat arrays without spaces", () => {
        expect(print([text("hello, "), text("world"), text("!")])).toEqual("hello, world!");
    });
});

describe("conditional group", () => {
    it("should print the first fitting line", () => {
        expect(
            print(
                conditionalGroup(
                    [
                        text("first long line"),
                        text("second long line"),
                        text("short line"),
                        text("not printed"),
                    ],
                    { id: "group" }
                ),
                { lineWidth: 10 }
            )
        ).toEqual("short line");
    });

    it("should print the only choice even if it doesn't fit", () => {
        expect(
            print(conditionalGroup([text("some very long line")], { id: "group" }), {
                lineWidth: 10,
            })
        ).toEqual("some very long line");
    });

    it("should handle nested docs", () => {
        const contents = "some very long line that will not fit on a single line";
        const words = contents.split(" ").map((word) => text(word));
        expect(
            print(
                conditionalGroup(
                    [
                        [text("# "), join(line, words)],
                        [fill(join(line, words)), hardline, text("<---->")],
                    ],
                    { id: "group" }
                ),
                { lineWidth: 20 }
            )
        ).toEqual("some very long line\nthat will not fit on\na single line\n<---->");
    });
});

describe("dedent", () => {
    it("should be a no-op at root indentation", () => {
        expect(print(dedent(text("hello")))).toEqual("hello");
    });

    it("should undo indentation levels", () => {
        expect(print(indent(dedent(text("hello"))))).toEqual("hello");
    });
});

describe("dedent to root", () => {
    it("should remove all indentation without root", () => {
        expect(print(indent(indent(dedentToRoot(text("42")))))).toEqual("42");
    });

    it("should remove all indentation up to the root level", () => {
        expect(
            print(align(text("> "), markAsRoot(indent(indent(dedentToRoot(text("42")))))))
        ).toEqual("> 42");
    });
});

describe("fill", () => {
    it("should print text longer than a line", () => {
        expect(print(fill([text("some very long line")]), { lineWidth: 10 })).toEqual(
            "some very long line"
        );
    });

    it("should fit as many values on a line as possible", () => {
        const items = Array(30)
            .fill("item ")
            .map((v, i) => v + i.toString())
            .map((v) => [text(v), text(",")]);

        expect(print([fill(join(line, items, true)), trim], { lineWidth: 24 }))
            .toMatchInlineSnapshot(`
"item 0, item 1, item 2,
item 3, item 4, item 5,
item 6, item 7, item 8,
item 9, item 10,
item 11, item 12,
item 13, item 14,
item 15, item 16,
item 17, item 18,
item 19, item 20,
item 21, item 22,
item 23, item 24,
item 25, item 26,
item 27, item 28,
item 29,"
`);
    });
});

describe("line", () => {
    describe("hard line", () => {
        it("should print a new line", () => {
            expect(print(hardline)).toEqual("\n");
        });

        it("should print a new line in the middle of the document", () => {
            expect(print([text("hello,"), hardline, text("world")])).toEqual("hello,\nworld");
        });

        it("should print a new line in the middle of a group that fits", () => {
            expect(print(group([text("hello,"), hardline, text("world")]))).toEqual(
                "hello,\nworld"
            );
        });

        it("should trim trailing whitespace", () => {
            expect(print([text("hello,      "), hardline, text("world")])).toEqual("hello,\nworld");
        });

        it("should preserve leading whitespace", () => {
            expect(print([text("hello,"), hardline, text("  world")])).toEqual("hello,\n  world");
        });
    });

    describe("auto line", () => {
        it("should print a new line", () => {
            expect(print(line)).toEqual("\n");
        });

        it("should print a new line in the middle of the document", () => {
            expect(print([text("hello,"), line, text("world")])).toEqual("hello,\nworld");
        });

        it("should be replaced by space in the middle of a group that fits", () => {
            expect(print(group([text("hello,"), line, text("world")]))).toEqual("hello, world");
        });
    });

    describe("soft line", () => {
        it("should print a new line", () => {
            expect(print(softline)).toEqual("\n");
        });

        it("should print a new line in the middle of the document", () => {
            expect(print([text("hello,"), softline, text("world")])).toEqual("hello,\nworld");
        });

        it("should be replaced by nothing in the middle of a group that fits", () => {
            expect(print(group([text("hello, "), softline, text("world")]))).toEqual(
                "hello, world"
            );
        });
    });

    describe("literal line", () => {
        it("should print a new line", () => {
            expect(print(literalline)).toEqual("\n");
        });

        it("should print a new line in the middle of the document", () => {
            expect(print([text("hello,"), literalline, text("world")])).toEqual("hello,\nworld");
        });

        it("should print a new line in the middle of a group that fits", () => {
            expect(print(group([text("hello,"), literalline, text("world")]))).toEqual(
                "hello,\nworld"
            );
        });

        it("should preserve trailing whitespace", () => {
            expect(print([text("hello,      "), literalline, text("world")])).toEqual(
                "hello,      \nworld"
            );
        });

        it("should preserve leading whitespace", () => {
            expect(print([text("hello,"), literalline, text("  world")])).toEqual(
                "hello,\n  world"
            );
        });

        it("should not indent text on new lines without root indents", () => {
            expect(print(indent([text("hello,"), literalline, text("  world")]))).toEqual(
                "    hello,\n  world"
            );
        });

        it("should indent text on new lines to root indentation", () => {
            expect(
                print(
                    align(
                        text(">"),
                        markAsRoot(indent([text("hello,"), literalline, text("  world")]))
                    )
                )
            ).toEqual(">    hello,\n>  world");
        });
    });
});

describe("if break", () => {
    it("should use break contents if parent group brakes", () => {
        expect(
            print(group([text("hello,"), line, ifBreak(text("world!"), text("flat")), breakParent]))
        ).toEqual("hello,\nworld!");
    });

    it("should use flat contents if parent group doesn't brake", () => {
        expect(
            print(group([text("hello,"), line, ifBreak(text("broken"), text("world!"))]))
        ).toEqual("hello, world!");
    });
});

describe("indent", () => {
    it("should indent", () => {
        expect(print(indent([text("indented")]), { useSpaces: false })).toEqual("\tindented");
    });

    it("should not indent the first line if it is not immediate", () => {
        expect(print(indent([text("indented")], false), { useSpaces: false })).toEqual("indented");
    });

    describe("array items", () => {
        let items: Doc[];
        let doc: Group;

        beforeAll(() => {
            items = Array(10)
                .fill("item")
                .map((v, i) => text(v + i.toString()));

            doc = group([
                text("["),
                indent([softline, join([text(","), line], items), ifBreak(text(","), text(""))]),
                softline,
                text("]"),
            ]);
        });

        it("should indent if group breaks", () => {
            expect(print(doc, { lineWidth: 25 })).toMatchInlineSnapshot(`
"[
    item0,
    item1,
    item2,
    item3,
    item4,
    item5,
    item6,
    item7,
    item8,
    item9,
]"
`);
        });

        it("should not indent items if group fits", () => {
            expect(print(doc)).toMatchInlineSnapshot(
                // eslint-disable-next-line quotes
                '"[item0, item1, item2, item3, item4, item5, item6, item7, item8, item9]"'
            );
        });

        it("should indent nested items", () => {
            const subitem = group([
                text("["),
                hardline,
                indent([
                    join([text(","), line], [text("itemA"), text("itemB")]),
                    ifBreak(text(","), text("")),
                ]),
                softline,
                text("]"),
            ]);
            const doc = group([
                text("["),
                indent([
                    softline,
                    join([text(","), softline], [...items, subitem]),
                    ifBreak(text(","), text("")),
                ]),
                softline,
                text("]"),
            ]);

            expect(print(doc, { lineWidth: 1000 })).toMatchInlineSnapshot(`
"[
    item0,
    item1,
    item2,
    item3,
    item4,
    item5,
    item6,
    item7,
    item8,
    item9,
    [
        itemA,
        itemB,
    ],
]"
`);
        });
    });
});

describe("line suffix", () => {
    it("should print line suffix at the end of the line", () => {
        expect(
            print(
                group([
                    text("line"),
                    lineSuffix(group([line, text("// a comment")])),
                    text(";"),
                    hardline,
                ])
            )
        ).toEqual("line; // a comment\n");
    });

    it("should print multiple line suffixes and the end of the line", () => {
        expect(
            print(
                group([
                    text("line"),
                    lineSuffix(group([line, text("//"), text(" "), text("a comment")])),
                    text(";"),
                    hardline,
                ])
            )
        ).toEqual("line; // a comment\n");
    });

    it("should print multiple separated line suffixes and the end of the line", () => {
        expect(
            print(
                group([
                    lineSuffix(group([line, text("//")])),
                    text("line"),
                    text(";"),
                    lineSuffix(group([text(" "), text("a comment")])),
                    hardline,
                ])
            )
        ).toEqual("line; // a comment\n");
    });

    it("should print line suffix before line suffix boundary", () => {
        expect(
            print(
                group([
                    text("{"),
                    lineSuffix(group([line, text("// a comment")])),
                    lineSuffixBoundary,
                    text("}"),
                ])
            )
        ).toEqual("{ // a comment\n}");
    });
});

describe("trim", () => {
    it("should trim trailing whitespace", () => {
        expect(print([text("  hello, world!  \t"), trim])).toEqual("  hello, world!");
    });
});
