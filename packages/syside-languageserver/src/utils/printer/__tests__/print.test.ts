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

import { DefaultPrinterConfig, group, line, printDoc, softline, text } from "..";
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
