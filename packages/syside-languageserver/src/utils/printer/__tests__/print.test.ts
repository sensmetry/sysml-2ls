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

import { EMPTY_STREAM } from "langium";
import {
    DefaultPrinterConfig,
    group,
    hardline,
    ifBreak,
    indent,
    indentIfBreak,
    line,
    lineSuffixBoundary,
    literals,
    print,
    printDoc,
    printIgnored,
    softline,
    text,
} from "..";
import * as ls from "vscode-languageserver";

describe("highlighting", () => {
    it("should collect highlighting ranges", () => {
        expect(
            printDoc(
                group([
                    text("function", { type: ls.SemanticTokenTypes.keyword }),
                    line,
                    text("hello", {
                        type: ls.SemanticTokenTypes.function,
                        modifiers: [ls.SemanticTokenModifiers.deprecated],
                    }),
                    text(" "),
                    text("("),
                    softline,
                    text(")"),
                ]),

                { ...DefaultPrinterConfig, highlighting: true }
            )
        ).toMatchInlineSnapshot(`
{
  "cursors": [],
  "highlighting": [
    {
      "end": 8,
      "modifiers": undefined,
      "start": 0,
      "type": "keyword",
    },
    {
      "end": 14,
      "modifiers": [
        "deprecated",
      ],
      "start": 9,
      "type": "function",
    },
  ],
  "text": "function hello ()
",
}
`);
    });
});

describe("prettier conformance", () => {
    it("should break groups like prettier", () => {
        // https://prettier.io/playground/#N4Igxg9gdgLgprEAuc0DOMAEBDTBeTACmwEolMAVfAPkwEYAGJkAGhAgAcYBLdZUbACdBEAO4AFIQjTIQ2ADajsATxlsARoOxgA1nBgBlbAFs4AGW5Q4yAGYK0cDVt36DHbZYDmyGIICujiAOxtw+-oFoXvJwAIp+EPC29oEAVmgAHgZRsfGJSHbyDmwAjrlw4iIcMijYaAC0VnAAJs2sIL7Y3PJeAMIQxsbYsgrybZFQntEAgjC+3Op+8OJwghZWSYWBABYwxvIA6lvc8GjuYHAG0sfcAG7HyrJgaGogNwEAklAtsAZggtxcKZfAwwZTRDZFEAcEQOfZaDiyaFwByCG7WNiWFEwCrYTyDCGBdyCFGydTYdRweR1GAvaGWGD7bhNGBbZB0AAsbEEcFK3G5OLxQ3yyTYMHJjOZrKQACY2H4HBRydUCpC4MYKU0Wk0zNgJn5cXAAGIQQSDWZeYaLCAgAC+NqAA
        const doc = [
            group([
                text("const"),
                text(" "),
                group([
                    group(text("a")),
                    text(" ="),
                    group(indent(line), { id: "assignment" }),
                    lineSuffixBoundary,
                    indentIfBreak(
                        group([
                            group(
                                group([
                                    text("("),
                                    indent([softline, text("a")]),
                                    ifBreak(text(","), literals.emptytext),
                                    softline,
                                    text(")"),
                                    text(":"),
                                    text(" "),
                                    text("T"),
                                ]),
                                { id: "arrow-chain" }
                            ),
                            text(" =>"),
                            group(indent([line, text("1000")])),
                        ]),
                        { groupId: "assignment" }
                    ),
                ]),
                indent([]),
                text(";"),
            ]),
            hardline,
        ];

        expect(print(doc, { lineWidth: 14, tabWidth: 2 })).toEqual(`const a = (
  a,
): T => 1000;
`);
    });
});

describe("utils", () => {
    it("should print ignore text withtout indentation", () => {
        const text = `
        line 1
            line 2
    line 3`;
        expect(
            print(
                indent([
                    hardline,
                    printIgnored(text, { offset: 0, end: text.length }, EMPTY_STREAM, new Set()),
                ])
            )
        ).toMatchInlineSnapshot(`
"
    
        line 1
            line 2
    line 3
"
`);
    });
});
