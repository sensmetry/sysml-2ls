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

import { parseKerML, parseSysML } from "../../../../testing";
import { services } from "../../../../testing";
import { TextDocumentIdentifier, SemanticTokens } from "vscode-languageserver";
import { AllSemanticTokenTypes, AllSemanticTokenModifiers } from "langium";
import { flagNames } from "../../../utils/common";

interface Case {
    text: string;
    expectations?: HighlightElement[];
    langID?: "kerml" | "sysml";
}

const testTable: Case[] = [
    {
        text: `package 'Vehicle' {
    part def Cylinder;
    part def Engine {
        part cylinder : Cylinder;
    }
}
`,
        expectations: [
            {
                line: 0,
                char: 8,
                length: 9,
                tokenTypeString: "namespace",
                tokenModifiersStrings: ["declaration"],
            },
            {
                line: 1,
                char: 13,
                length: 8,
                tokenTypeString: "class",
                tokenModifiersStrings: [],
            },
            {
                line: 2,
                char: 13,
                length: 6,
                tokenTypeString: "class",
                tokenModifiersStrings: [],
            },
            {
                line: 3,
                char: 13,
                length: 8,
                tokenTypeString: "variable",
                tokenModifiersStrings: ["declaration"],
            },
        ],
    },

    {
        text: `package Ab;
package C; package D;
`,
        expectations: [
            {
                line: 0,
                char: 8,
                length: 2,
                tokenTypeString: "namespace",
                tokenModifiersStrings: ["declaration"],
            },
        ],
    },

    {
        text: `/*some text
*  another line
*/`,
        expectations: [
            {
                line: 0,
                char: 0,
                length: 11,
                tokenTypeString: "annotationBody",
                tokenModifiersStrings: [],
            },

            {
                line: 1,
                char: 0,
                length: 15,
                tokenTypeString: "annotationBody",
                tokenModifiersStrings: [],
            },
        ],
    },

    {
        text: `/*some text
*  another line
*/`,
        expectations: [
            {
                line: 0,
                char: 0,
                length: 11,
                tokenTypeString: "annotationBody",
                tokenModifiersStrings: [],
            },
        ],
    },

    {
        langID: "kerml",
        text: `classifier A;
classifier B;
specialization Super subclassifier A specializes B;
specialization subclassifier B :> A {
    doc /* unnamed */
}`,
        expectations: [
            {
                line: 2,
                char: 15,
                length: 5,
                tokenTypeString: "relationship",
                tokenModifiersStrings: ["declaration"],
            },
            {
                line: 3,
                char: 34,
                length: 1,
                tokenTypeString: "type",
                tokenModifiersStrings: ["definition"],
            },
        ],
    },

    {
        langID: "kerml",
        text: `namespace Annotations {
    metaclass Approved;
}
namespace NA {
    type A {
        @Annotations::Approved;
    }
}
`,
        expectations: [
            {
                line: 1,
                char: 14,
                length: 8,
                tokenTypeString: "metaclass",
                tokenModifiersStrings: [],
            },
        ],
    },
];

const snapshotTestTable: Case[] = [
    {
        text: `package 'Vehicle' {
part def Cylinder;
part def Engine {
    part cylinder : Cylinder;
}
}
`,
    },
    {
        text: `package 'Test' {

    enum def TrafficLightColor {
        enum Green;
        enum Yellow;
        enum Red;
    }
    
    currentColor = TrafficLightColor::Green;
}
`,
    },
    {
        text: `package Metaobjects {
            metadata def SemanticMetadata {
                attribute baseType;
            }
        }
        
        library package example {
            import Metaobjects::SemanticMetadata;
        
            metadata def situation :> SemanticMetadata;
        }`,
    },
    {
        langID: "kerml",
        text: `standard library package Pack {
    // comment
    //* multi-line comment */
    
    abstract class <klass> Klass;
    alias KK for Klass;

    comment Comment /* comment */

    type Type {
        doc /* doc */
    }

    metaclass Meta;
    #Meta feature f : KK {
        @Meta {}
    }

    struct Struct;
    assoc Assoc;
    assoc struct AssocStruct;

    feature Value = "some string";
    readonly feature Number = 1.0;

    abstract function Function {}
    abstract expr Expression {}

    rep Rep language "kerml" /* class K; */
    specialization S subtype Struct :> klass;
}`,
    },
];

interface HighlightElement {
    line: number;
    char: number;
    length: number;
    tokenTypeString: string;
    tokenModifiersStrings: string[];
}

const INTS_PER_TOKEN = 5;
const Flags = new Map(
    Object.entries(AllSemanticTokenModifiers).map(([name, flag]) => [flag, name])
);
const TypeNames = Object.keys(AllSemanticTokenTypes);

function deserialiseSemanticTokenData(
    semanticTokens: SemanticTokens | undefined
): HighlightElement[] | undefined {
    if (semanticTokens == undefined) return undefined;

    const elements: HighlightElement[] = [];
    let line = 0;
    let char = 0;
    for (let i = 0; i < semanticTokens?.data.length; i += INTS_PER_TOKEN) {
        const line_delta = semanticTokens.data[i];
        const char_delta = semanticTokens.data[i + 1];
        const length = semanticTokens?.data[i + 2];
        const tokenType = semanticTokens?.data[i + 3];
        const tokenModifiers = semanticTokens?.data[i + 4];

        line += line_delta;
        if (line_delta != 0) {
            char = 0;
        }
        char += char_delta;

        const tokenTypeString = TypeNames[tokenType];
        const tokenModifiersStrings = flagNames(tokenModifiers, Flags);
        elements.push({
            line,
            char,
            length,
            tokenTypeString,
            tokenModifiersStrings,
        });
    }
    return elements;
}

async function getSemanticTokenData(testCase: Case): Promise<SemanticTokens | undefined> {
    const result = await (testCase.langID === "kerml" ? parseKerML : parseSysML)(testCase.text);
    const document = result.value.$document;

    expect(document).toBeDefined();
    expect(result.lexerErrors).toEqual([]);
    expect(result.parserErrors).toEqual([]);

    if (!document) return;

    const semanticTokens = services.SysML.lsp.SemanticTokenProvider?.semanticHighlight(document, {
        textDocument: TextDocumentIdentifier.create(document.uriString),
    });
    expect(semanticTokens).toBeDefined();
    return semanticTokens;
}

async function runSemanticTokenTest(testCase: Case): Promise<void> {
    const semanticTokens = await getSemanticTokenData(testCase);

    const elements = deserialiseSemanticTokenData(semanticTokens);

    if (!testCase.expectations) return;

    expect(elements).toEqual(
        expect.arrayContaining(testCase.expectations.map((e) => expect.objectContaining(e)))
    );
}

async function runSemanticTokenSnapshotTest(testCase: Case): Promise<void> {
    const semanticTokens = await getSemanticTokenData(testCase);
    expect(semanticTokens).toBeDefined();
    if (!semanticTokens) return;

    expect(semanticTokens.data).toMatchSnapshot();
}

test.concurrent.each(testTable)("Semantic token provider test", runSemanticTokenTest);

test.each(snapshotTestTable)("Semantic token provider snapshot test", runSemanticTokenSnapshotTest);
