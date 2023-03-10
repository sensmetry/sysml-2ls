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

/* eslint-disable quotes */
import { prettyAnnotationBody } from "../../../model";

describe("elements are parseable with annotations", () => {
    // TODO: strip surrounding /* */ from annotations, it would be nice to display comments on hover
    test("with single line comment", async () => {
        return expect("namespace { comment /* this is a comment */ }").toParseKerML("snapshot");
    });

    test("with single line comment without a keyword", async () => {
        return expect("namespace { /* this is a comment */ }").toParseKerML("snapshot");
    });

    // TODO: strip leading whitespace and optionally * in multiline annotation bodies
    test("with multi line comment", async () => {
        return expect(`
namespace {
    comment /* this is
             * a comment
             */ }`).toParseKerML("snapshot");
    });

    test("with a named single line comment", async () => {
        return expect("namespace { comment Comment /* this is a comment */ }").toParseKerML(
            "snapshot"
        );
    });

    test("with named documentation", async () => {
        return expect("namespace { doc Doc /* this is a doc */ }").toParseKerML("snapshot");
    });

    test("with unnamed documentation", async () => {
        return expect("namespace { doc /* this is a doc */ }").toParseKerML("snapshot");
    });

    // TODO: reference requires that the body of TextualRepresentation is valid KerML in the owning element context if language is KerML, any other languages can be opaque
    describe("with textual representation", () => {
        test("with keyword", () => {
            return expect('rep inOCL language "OCL" /* self.x > 0.0 */').toParseKerML("snapshot");
        });

        test("with keyword and no name", async () => {
            return expect('rep language "OCL" /* self.x > 0.0 */').toParseKerML("snapshot");
        });

        test("without keyword", async () => {
            return expect(`namespace B { 
                language "HTML" 
                    /* <a href="https://plm.elsewhere.com/part?id="1234"/> */
            }`).toParseKerML("snapshot");
        });
    });
});

test("Multiple comments are parsed", async () => {
    expect(`namespace {
        /* comment 1 */   
        /* comment 2 */   
    }`).toParseKerML("snapshot");
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
