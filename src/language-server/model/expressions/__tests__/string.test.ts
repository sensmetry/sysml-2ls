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
import { expectEvaluationResult } from "./util";

const PACKAGE = `
package StringFunctions {
    ${["Length", "Substring"].map((f) => "abstract function " + f).join(";\n\t")};
}
`;

test.concurrent.each([
    ["Length", 'StringFunctions::Length("string")', [6]],
    ["Length", 'StringFunctions::Length("")', [0]],
    ["Length", "StringFunctions::Length(null)", expect.stringContaining("Not a string")],
    ["Substring", 'StringFunctions::Substring("string", 1, 4)', ["stri"]],
    ["Substring", 'StringFunctions::Substring("string", 3, 4)', ["ri"]],
])("%s (%s) can be evaluated", async (_: string, body: string, expected) => {
    await expectEvaluationResult({
        text:
            PACKAGE +
            `
        in feature a = ${body};
        `,
        langId: "kerml",
        ...(Array.isArray(expected)
            ? { result: expected }
            : {
                  error: {
                      message: expected,
                  },
              }),
    });
});
