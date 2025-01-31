/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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

/* eslint-disable quotes */
import { Comment, Documentation, TextualRepresentation } from "../../../generated/ast";
import { prettyAnnotationBody } from "../../../model";
import { parsedNode } from "../../../testing/utils";

describe("elements are parseable with annotations", () => {
    // TODO: strip surrounding /* */ from annotations, it would be nice to display comments on hover
    test("with single line comment", async () => {
        return expect(
            parsedNode("namespace { comment /* this is a comment */ }", {
                node: Comment,
            })
        ).resolves.toMatchObject({ body: "/* this is a comment */" });
    });

    test("with single line comment without a keyword", async () => {
        return expect(
            parsedNode("namespace { /* this is a comment */ }", {
                node: Comment,
            })
        ).resolves.toMatchObject({ body: "/* this is a comment */" });
    });

    // TODO: strip leading whitespace and optionally * in multiline annotation bodies
    test("with multi line comment", async () => {
        return expect(
            parsedNode(
                `
namespace {
    comment /* this is
             * a comment
             */ }`,
                {
                    node: Comment,
                }
            )
        ).resolves.toMatchObject({
            body: `/* this is
             * a comment
             */`,
        });
    });

    test("with a named single line comment", async () => {
        return expect(
            parsedNode("namespace { comment Comment /* this is a comment */ }", {
                node: Comment,
            })
        ).resolves.toMatchObject({ body: "/* this is a comment */" });
    });

    test("with named documentation", async () => {
        return expect(
            parsedNode("namespace { doc Doc /* this is a doc */ }", {
                node: Documentation,
            })
        ).resolves.toMatchObject({ body: "/* this is a doc */" });
    });

    test("with unnamed documentation", async () => {
        return expect(
            parsedNode("namespace { doc /* this is a doc */ }", {
                node: Documentation,
            })
        ).resolves.toMatchObject({ body: "/* this is a doc */" });
    });

    // TODO: reference requires that the body of TextualRepresentation is valid KerML in the owning element context if language is KerML, any other languages can be opaque
    describe("with textual representation", () => {
        test("with keyword", () => {
            return expect(
                parsedNode('rep inOCL language "OCL" /* self.x > 0.0 */', {
                    node: TextualRepresentation,
                })
            ).resolves.toMatchObject({ body: "/* self.x > 0.0 */", language: `"OCL"` });
        });

        test("with keyword and no name", async () => {
            return expect(
                parsedNode('rep language "OCL" /* self.x > 0.0 */', {
                    node: TextualRepresentation,
                })
            ).resolves.toMatchObject({ body: "/* self.x > 0.0 */", language: `"OCL"` });
        });

        test("without keyword", async () => {
            return expect(
                parsedNode(
                    `namespace B { 
                language "HTML" 
                    /* <a href="https://plm.elsewhere.com/part?id="1234"/> */
            }`,
                    { node: TextualRepresentation }
                )
            ).resolves.toMatchObject({
                body: `/* <a href="https://plm.elsewhere.com/part?id="1234"/> */`,
                language: `"HTML"`,
            });
        });
    });
});

test("Multiple comments are parsed", async () => {
    return expect(
        parsedNode(
            `namespace {
        /* comment 1 */   
        /* comment 2 */   
    }`,
            {
                node: Comment,
                index: 1,
            }
        )
    ).resolves.toMatchObject({ body: "/* comment 2 */" });
});

describe("Annotation bodies are correctly stripped of leading whitespace and *", () => {
    test("Single line bodies preserve the text", () => {
        expect(prettyAnnotationBody("/* some text */")).toEqual("some text");
        expect(prettyAnnotationBody("/*some text*/")).toEqual("some text");
    });

    test("Line-breaks are preserved", () => {
        expect(
            prettyAnnotationBody(`/*some text
                                    another line
                                   */`)
        ).toEqual("some text\nanother line");
    });

    test("Leading * preserves indentation minus the first space", () => {
        expect(
            prettyAnnotationBody(`/*some text
                                   *  another line
                                   */`)
        ).toEqual("some text\n another line");
    });

    test("Empty first line is removed", () => {
        expect(
            prettyAnnotationBody(`
        /*
	     * Anything is the top level generalized type in the language. 
	     */
    `)
        ).toEqual("Anything is the top level generalized type in the language.");
    });
});
