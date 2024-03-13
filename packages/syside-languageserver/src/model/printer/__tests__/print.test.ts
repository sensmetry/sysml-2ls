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

import { LeafCstNode } from "langium";
import { printDoc, text } from "../../../utils";
import { LiteralInfinityMeta, NullExpressionMeta } from "../../KerML";
import {
    collectUnprintedNotes,
    defaultKerMLPrinterContext,
    defaultPrintNotes,
    defaultSysMLPrinterContext,
    printModelRange,
} from "../print";
import { expectPrinted, getPrintRange, makeEmpty } from "./utils";
import { ElementRange } from "../utils";

describe("notes", () => {
    let warn: typeof console.warn;
    beforeEach(() => {
        warn = console.warn;
        console.warn = jest.fn();
    });
    afterEach(() => {
        console.warn = warn;
    });

    it("should print missing inner notes", () => {
        const node = makeEmpty(LiteralInfinityMeta);
        node.notes.push({
            kind: "line",
            localPlacement: "inner",
            placement: "ownLine",
            text: " a note",
            $cstNode: {} as unknown as LeafCstNode,
        });
        const context = defaultKerMLPrinterContext();
        expect(collectUnprintedNotes(node, context.printed)).toHaveLength(1);

        expect(printDoc(defaultPrintNotes(text("{}"), node, context)).text).toMatchInlineSnapshot(`
"// a note
{}
"
`);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(collectUnprintedNotes(node, context.printed)).toHaveLength(0);
    });

    it("should print leading and trailing notes", () => {
        const node = makeEmpty(NullExpressionMeta);
        node.notes.push(
            {
                kind: "line",
                localPlacement: "leading",
                placement: "ownLine",
                text: " leading",
                $cstNode: {} as unknown as LeafCstNode,
            },
            {
                kind: "line",
                localPlacement: "trailing",
                placement: "ownLine",
                text: " trailing",
                $cstNode: {} as unknown as LeafCstNode,
            }
        );

        expect(printDoc(defaultPrintNotes(text("{}"), node, defaultKerMLPrinterContext())).text)
            .toMatchInlineSnapshot(`
"// leading
{} // trailing
"
`);
        expect(console.warn).toHaveBeenCalledTimes(0);
    });

    it("should print inner notes inside children blocks", async () => {
        await expectPrinted(`class A { //* inner */ }`, {
            lang: "kerml",
            node: "Class",
        }).resolves.toEqual("class A { //* inner */ }\n");

        await expectPrinted(`class A { //* inner */ }`, {
            lang: "kerml",
            node: "Class",
            format: { empty_namespace_brackets: { default: "never" } },
        }).resolves.toEqual("class A; //* inner */\n");

        expect(console.warn).toHaveBeenCalledTimes(0);
    });

    it("should take into account attached notes when adding line breaks", async () => {
        return expectPrinted(
            `
            package P {
                // leading
                private class A; // trailing


                // first leading


                // second leading
                class B;
            }`,
            { lang: "kerml", node: "Namespace" }
        ).resolves.toMatchInlineSnapshot(`
"package P {
    // leading
    private class A; // trailing

    // first leading

    // second leading
    class B;
}
"
`);
    });

    it("should print with some children format ignored", async () => {
        return expectPrinted(
            `
            package P {


                // leading
                class A; // trailing


                // syside-format ignore


                    class B {  //* inner */             } // trailing
            }`,
            { lang: "kerml", node: "Namespace" }
        ).resolves.toMatchInlineSnapshot(`
"package P {
    // leading
    class A; // trailing

    // syside-format ignore

    class B {  //* inner */             } // trailing
}
"
`);
    });
});

describe("notes formatting", () => {
    it("should remove extraneous lines to single line comments when the comment is the first child element", () => {
        return expectPrinted(
            `part A{
        
        
        
        // comment
    }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part A {
    // comment
}\n`
        );
    });

    it("should remove extraneous lines to multiline comments when the comment is the first child element", () => {
        return expectPrinted(
            `part A{
        
        
        
        //* comment
        */
    }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part A {
    //* comment
      */
}\n`
        );
    });

    it("should remove extraneous lines to single line comments when the comment is not the first child element", () => {
        return expectPrinted(
            `part A{part a: A;
        
        
        
        // comment
    }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part A {
    part a : A;

    // comment
}\n`
        );
    });

    it("should remove extraneous lines to multiline comments when the comment is not the first child element", () => {
        return expectPrinted(
            `part A{part a: A;
        
        
        
        //* comment
        */
    }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part A {
    part a : A;

    //* comment
      */
}\n`
        );
    });

    it("should remove any whitespace to the root comment if it's the first element", () => {
        return expectPrinted(
            `
    
    
    // comment
`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual("// comment\n");
    });

    it("should respect and indent AST continuations intersected by comments", () => {
        return expectPrinted(
            `
        #   // a comment



        Meta part P {
        }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `# // a comment

        Meta
part P {}\n`
        );
    });

    it("should respect and indent AST continuations intersected by comments and indented by tabs", () => {
        return expectPrinted(
            `
        #   // a comment



        Meta part P {
        }`,
            { lang: "sysml", node: "Namespace", options: { useSpaces: false } }
        ).resolves.toEqual(
            `# // a comment

\t\tMeta
part P {}\n`
        );
    });

    it("should leave a single leading space to end of line comment", () => {
        return expectPrinted("part P {}     // comment", {
            lang: "sysml",
            node: "Namespace",
        }).resolves.toEqual("part P {} // comment\n");
    });

    describe("should format comments in the root namespace", () => {
        it("with no empty lines to the previous element", () => {
            return expectPrinted(
                `part P {}
        // comment`,
                { lang: "sysml", node: "Namespace" }
            ).resolves.toEqual(
                `part P {}
// comment\n`
            );
        });

        it("with multiple empty lines to the previous element", () => {
            return expectPrinted(
                `part P {}


        // comment`,
                { lang: "sysml", node: "Namespace" }
            ).resolves.toEqual(
                `part P {}

// comment\n`
            );
        });
    });

    it("should leave a single leading space to end of line multiline comment", () => {
        return expectPrinted("part P {}     //* comment */", {
            lang: "sysml",
            node: "Namespace",
        }).resolves.toEqual("part P {} //* comment */\n");
    });

    it("should format comments inside a reference", () => {
        return expectPrinted("part P: A::       //* comment */   B {}", {
            lang: "sysml",
            node: "Namespace",
        }).resolves.toEqual("part P : A:: //* comment */ B {}\n");
    });

    it("should format comments inside a multiline reference", () => {
        return expectPrinted(
            `
        part P: A::       // comment
        
            B {}`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part P
    :
        A // comment
            ::B {}\n`
        );
    });
});

describe("printing ranges", () => {
    const expectPrintedRange = (text: string): jest.JestMatchers<Promise<string>> => {
        return expect(
            getPrintRange(text, { lang: "sysml" }).then((range) => {
                expect(range).toBeDefined();

                return printDoc(
                    printModelRange(range as ElementRange, defaultSysMLPrinterContext())
                ).text;
            })
        );
    };

    it("should print enclosed elements", async () => {
        return expectPrintedRange(
            `package P {
            part i;
            part j {
                part k {
                    |private item x;
                    protected item y;|
                    item z;
                }
            }
        }`
        ).resolves.toMatchInlineSnapshot(`
"private item x;
            protected item y;
"
`);
    });

    it("should print the element enclosing the range", async () => {
        return expectPrintedRange(
            `package P {
            part i;
            part j {
                part k {
                    private ite|m| x;
                    item y;
                    item z;
                }
            }
        }`
        ).resolves.toMatchInlineSnapshot(`
"private item x;
"
`);
    });

    it("should print elements surrouding the range whitespace", async () => {
        return expectPrintedRange(
            `package P {
            part i;
            part j {
                part k {
                    item x {   }

                    ||

                    item y { }
                    item z;
                }
            }
        }`
        ).resolves.toMatchInlineSnapshot(`
"item x {   }

            item y { }
"
`);
    });

    it("should print with attached notes", async () => {
        return expectPrintedRange(
            `package P {
            part i;
            part j {
                part k {
                    // leading
                    ite|m| x; // trailing

                    item y;
                    item z;
                }
            }
        }`
        ).resolves.toMatchInlineSnapshot(`
"// leading
            item x; // trailing
"
`);
    });

    it("should print relationship owned elements", async () => {
        return expectPrintedRange(
            `package P {
            part i;
            part j {
                import A {
                    doc ||
                    /* doc */
                }
            }
        }`
        ).resolves.toMatchInlineSnapshot(`
"doc
            /*
             * doc
             */
"
`);
    });

    it("should correctly join succession shorthands", async () => {
        return expectPrintedRange(
            `package P {
    action j {
        first start;

        then a;
        |then decide;
            then b;
            then c;|
    }
}`
        ).resolves.toMatchInlineSnapshot(`
"then decide;
            then b;
            then c;
"
`);
    });
});

describe("notes formatting", () => {
    it("should remove extraneous lines to single line comments when the comment is the first child element", () => {
        return expectPrinted(
            `part A{
        
        
        
        // comment
    }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part A {
    // comment
}\n`
        );
    });

    it("should remove extraneous lines to multiline comments when the comment is the first child element", () => {
        return expectPrinted(
            `part A{
        
        
        
        //* comment
        */
    }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part A {
    //* comment
      */
}\n`
        );
    });

    it("should remove extraneous lines to single line comments when the comment is not the first child element", () => {
        return expectPrinted(
            `part A{part a: A;
        
        
        
        // comment
    }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part A {
    part a : A;

    // comment
}\n`
        );
    });

    it("should remove extraneous lines to multiline comments when the comment is not the first child element", () => {
        return expectPrinted(
            `part A{part a: A;
        
        
        
        //* comment
        */
    }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part A {
    part a : A;

    //* comment
      */
}\n`
        );
    });

    it("should remove any whitespace to the root comment if it's the first element", () => {
        return expectPrinted(
            `
    
    
    // comment
`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual("// comment\n");
    });

    it("should respect and indent AST continuations intersected by comments", () => {
        return expectPrinted(
            `
        #   // a comment



        Meta part P {
        }`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `# // a comment

        Meta
part P {}\n`
        );
    });

    it("should respect and indent AST continuations intersected by comments and indented by tabs", () => {
        return expectPrinted(
            `
        #   // a comment



        Meta part P {
        }`,
            { lang: "sysml", node: "Namespace", options: { useSpaces: false } }
        ).resolves.toEqual(
            `# // a comment

\t\tMeta
part P {}\n`
        );
    });

    it("should leave a single leading space to end of line comment", () => {
        return expectPrinted("part P {}     // comment", {
            lang: "sysml",
            node: "Namespace",
        }).resolves.toEqual("part P {} // comment\n");
    });

    describe("should format comments in the root namespace", () => {
        it("with no empty lines to the previous element", () => {
            return expectPrinted(
                `part P {}
        // comment`,
                { lang: "sysml", node: "Namespace" }
            ).resolves.toEqual(
                `part P {}
// comment\n`
            );
        });

        it("with multiple empty lines to the previous element", () => {
            return expectPrinted(
                `part P {}


        // comment`,
                { lang: "sysml", node: "Namespace" }
            ).resolves.toEqual(
                `part P {}

// comment\n`
            );
        });
    });

    it("should leave a single leading space to end of line multiline comment", () => {
        return expectPrinted("part P {}     //* comment */", {
            lang: "sysml",
            node: "Namespace",
        }).resolves.toEqual("part P {} //* comment */\n");
    });

    it("should format comments inside a reference", () => {
        return expectPrinted("part P: A::       //* comment */   B {}", {
            lang: "sysml",
            node: "Namespace",
        }).resolves.toEqual("part P : A:: //* comment */ B {}\n");
    });

    it("should format comments inside a multiline reference", () => {
        return expectPrinted(
            `
        part P: A::       // comment
        
            B {}`,
            { lang: "sysml", node: "Namespace" }
        ).resolves.toEqual(
            `part P
    :
        A // comment
            ::B {}\n`
        );
    });
});
