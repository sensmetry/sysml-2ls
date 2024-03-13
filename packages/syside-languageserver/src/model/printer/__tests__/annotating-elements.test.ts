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

import { DeepPartial } from "langium";
import { PrinterTestContext, printKerMLElement, printSysMLElement } from "./utils";
import {
    Comment,
    Documentation,
    MetadataFeature,
    MetadataUsage,
    TextualRepresentation,
} from "../../../generated/ast";
import { parsedNode } from "../../../testing/utils";

describe("comments", () => {
    const expectPrinted = async (
        text: string,
        context?: DeepPartial<PrinterTestContext>
    ): Promise<jest.JestMatchers<string>> => {
        const e = await parsedNode(text, { lang: "kerml", node: Comment });
        return expect(printKerMLElement(e.$meta, context));
    };

    it("should print short comments", async () => {
        (await expectPrinted("/* a comment */")).toEqual("/*\n * a comment\n */\n");
    });

    it("should print multi-line comments", async () => {
        (await expectPrinted("/*\na  \ncomment  \n*/")).toEqual("/*\n * a  \n * comment\n */\n");
    });

    it("should trim trailing whitespace from non-markdown bodies", async () => {
        (
            await expectPrinted("/*\na  \ncomment  \n*/", { format: { markdown_comments: false } })
        ).toEqual("/*\n * a\n * comment\n */\n");
    });

    it("should preserve comment keyword if option is set", async () => {
        (
            await expectPrinted("comment /* a comment */", {
                format: { comment_keyword: { default: "preserve" } },
            })
        ).toEqual("comment\n/*\n * a comment\n */\n");
    });

    it("should always print comment keyword if options is set", async () => {
        (
            await expectPrinted("/* a comment */", {
                format: { comment_keyword: { default: "always" } },
            })
        ).toEqual("comment\n/*\n * a comment\n */\n");
    });

    it("should print comment with identifiers", async () => {
        (await expectPrinted("comment <short> long /* a comment */")).toEqual(`comment <short> long
/*
 * a comment
 */
`);
    });

    it("should print comment with explicit about fitting on one line", async () => {
        (await expectPrinted("comment about A /* a comment */")).toEqual(`comment about A
/*
 * a comment
 */
`);
    });

    it("should print comment with explicit aboutt with a line break", async () => {
        (
            await expectPrinted("comment about A /* a comment */", {
                format: { comment_about_break: "always" },
            })
        ).toEqual(`comment
    about A
/*
 * a comment
 */
`);
    });

    it("should handle inner notes", async () => {
        (await expectPrinted("comment <short> // inner\n long /* a comment */"))
            .toEqual(`comment <short> long // inner
/*
 * a comment
 */
`);
    });

    it("should break after identifiers if they fit", async () => {
        (
            await expectPrinted(
                "comment <'long short name........'> 'long regular name........' about 'some long reference', 'another long reference' /* a comment */",
                { options: { lineWidth: 100 } }
            )
        ).toEqual(`comment <'long short name........'> 'long regular name........'
    about 'some long reference', 'another long reference'
/*
 * a comment
 */
`);
    });

    it("should break identifiers and about list", async () => {
        (
            await expectPrinted(
                "comment <'long short name........'> 'long regular name........' about 'some long reference', 'another long reference' /* a comment */",
                { options: { lineWidth: 30 } }
            )
        ).toMatchInlineSnapshot(`
"comment <
        'long short name........'
    > 'long regular name........'
    about
        'some long reference',
        'another long reference'
/*
 * a comment
 */
"
`);
    });

    it("should not leave a trailing space on an empty line", async () => {
        (
            await expectPrinted(
                `
        /* 1
        *
        * 2
        */`
            )
        ).toEqual(
            `/*
 * 1
 *
 * 2
 */\n`
        );
    });
});

describe("documentation", () => {
    const expectPrinted = async (
        text: string,
        context?: DeepPartial<PrinterTestContext>
    ): Promise<jest.JestMatchers<string>> => {
        const e = await parsedNode(text, { lang: "kerml", node: Documentation });
        return expect(printKerMLElement(e.$meta, context));
    };

    it("should print docs without identifiers", async () => {
        (await expectPrinted("doc /* doc */")).toEqual("doc\n/*\n * doc\n */\n");
    });

    it("should print docs with identifiers", async () => {
        (await expectPrinted("doc <short> long /* doc */")).toEqual(
            "doc <short> long\n/*\n * doc\n */\n"
        );
    });

    it("should break on long identifiers", async () => {
        (
            await expectPrinted("doc <'long short name.....'> 'long regular name.....' /* doc */", {
                options: { lineWidth: 20 },
            })
        ).toMatchInlineSnapshot(`
"doc <
        'long short name.....'
    > 'long regular name.....'
/*
 * doc
 */
"
`);
    });

    it("should handle inner notes", async () => {
        (await expectPrinted("doc // note\n/* doc */")).toEqual("doc // note\n/*\n * doc\n */\n");
    });
});

describe("textual representations", () => {
    const expectPrinted = async (
        text: string,
        context?: DeepPartial<PrinterTestContext>
    ): Promise<jest.JestMatchers<string>> => {
        const e = await parsedNode(text, { lang: "kerml", node: TextualRepresentation });
        return expect(printKerMLElement(e.$meta, context));
    };

    it("should print short textual representations", async () => {
        (await expectPrinted('rep language "text" /* note */')).toMatchInlineSnapshot(`
"rep
    language "text"
/*
 * note
 */
"
`);
    });

    it("should preserve 'rep' if option is set", async () => {
        (
            await expectPrinted('rep language "text" /* note */', {
                format: {
                    textual_representation_keyword: { default: "preserve" },
                    textual_representation_language_break: "as_needed",
                },
            })
        ).toMatchInlineSnapshot(`
"rep language "text"
/*
 * note
 */
"
`);
    });

    it("should always add 'rep' if option is set", async () => {
        (
            await expectPrinted('language "text" /* note */', {
                format: {
                    textual_representation_keyword: { default: "always" },
                    textual_representation_language_break: "as_needed",
                },
            })
        ).toMatchInlineSnapshot(`
"rep language "text"
/*
 * note
 */
"
`);
    });

    it("should break on language if option is set", async () => {
        (
            await expectPrinted('rep language "text" /* note */', {
                format: {
                    textual_representation_keyword: { default: "preserve" },
                    textual_representation_language_break: "always",
                },
            })
        ).toMatchInlineSnapshot(`
"rep
    language "text"
/*
 * note
 */
"
`);
    });

    it("should handle inner notes", async () => {
        (
            await expectPrinted('rep // note\nlanguage "text" /* note */', {
                format: {
                    textual_representation_keyword: { default: "preserve" },
                    textual_representation_language_break: "as_needed",
                },
            })
        ).toMatchInlineSnapshot(`
"rep language "text" // note
/*
 * note
 */
"
`);
    });

    it("should break on long identifiers", async () => {
        (
            await expectPrinted(
                "rep <'some long short identifier...'> 'some long regular identifier.........' language \"text\" /* note */",
                {
                    options: {
                        lineWidth: 20,
                    },
                    format: {
                        textual_representation_keyword: { default: "preserve" },
                        textual_representation_language_break: "always",
                    },
                }
            )
        ).toMatchInlineSnapshot(`
"rep <
        'some long short identifier...'
    > 'some long regular identifier.........'
    language "text"
/*
 * note
 */
"
`);
    });
});

describe("metadata features", () => {
    const expectPrinted = async (
        text: string,
        context?: DeepPartial<PrinterTestContext> & { lang?: "kerml" | "sysml" }
    ): Promise<jest.JestMatchers<string>> => {
        const lang = context?.lang ?? "kerml";
        const node = lang === "kerml" ? MetadataFeature : MetadataUsage;
        const e = await parsedNode(text, { lang, node });
        return expect((lang === "kerml" ? printKerMLElement : printSysMLElement)(e.$meta, context));
    };

    it("should print metadata features", async () => {
        (await expectPrinted("@ Meta about a {}")).toEqual("@Meta about a {}\n");
    });

    it("should preserve metadata keyword", async () => {
        (await expectPrinted("metadata Meta about a {}")).toEqual("metadata Meta about a {}\n");
    });

    it("should print identifiers", async () => {
        (await expectPrinted("@ Meta : Other about a {}")).toEqual("@Meta : Other about a {}\n");
    });

    it("should preserve typing keyword in KerML", async () => {
        (await expectPrinted("@ Meta typed by Other about a {}")).toEqual(
            "@Meta typed by Other about a {}\n"
        );
    });

    it("should preserve typing keyword in SysML", async () => {
        (await expectPrinted("@ Meta defined by Other about a {}", { lang: "sysml" })).toEqual(
            "@Meta defined by Other about a {}\n"
        );
    });

    it("should break at about first", async () => {
        (await expectPrinted("@ Meta : Other about a {}", { options: { lineWidth: 20 } })).toEqual(
            "@Meta : Other\n    about a {}\n"
        );
    });

    it("should break at heritage last", async () => {
        (
            await expectPrinted("@ 'some long name here' : Other about a {}", {
                options: { lineWidth: 25 },
            })
        ).toEqual("@'some long name here'\n    : Other\n    about a {}\n");
    });

    it("should print body elements in KerML", async () => {
        (await expectPrinted("@ Meta { value = 3;\n\n\n/* comment */ }", {})).toEqual(
            `@Meta {
    value = 3;

    /*
     * comment
     */
}\n`
        );
    });

    it("should print body elements in SysML", async () => {
        (
            await expectPrinted("@ Meta { value = 3;\n\n\n/* comment */ }", {
                lang: "sysml",
                format: { metadata_body_feature_keyword: { default: "always" } },
            })
        ).toEqual(
            `@Meta {
    ref value = 3;

    /*
     * comment
     */
}\n`
        );
    });

    it("should preserve body feature redefines token", async () => {
        (await expectPrinted("@ Meta { :>> value = 3;}")).toEqual(
            `@Meta {
    :>> value = 3;
}\n`
        );
    });

    it("should preserve body feature redefines token", async () => {
        (await expectPrinted("@ Meta { redefines value = 3;}")).toEqual(
            `@Meta {
    redefines value = 3;
}\n`
        );
    });

    it("should preserve body feature skipped redefines", async () => {
        (await expectPrinted("@ Meta { value = 3;}")).toEqual(
            `@Meta {
    value = 3;
}\n`
        );
    });
});
