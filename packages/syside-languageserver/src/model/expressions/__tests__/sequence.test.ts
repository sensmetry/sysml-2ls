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

import { expectEvaluationResult } from "./util";

const PACKAGE = `
package SequenceFunctions {
    ${["includes", "isEmpty", "notEmpty", "size"]
        .map((f) => "abstract function " + f)
        .join(";\n\t")};
}
`;

test.concurrent.each([
    ["Includes", "SequenceFunctions::includes((1,2,3,4), 1)", [true]],
    ["Includes", "SequenceFunctions::includes((1,2,3,4), 0)", [false]],
    ["Includes", "SequenceFunctions::includes(4, 4)", [true]],
    ["Includes", "SequenceFunctions::includes(4, 1)", [false]],
    ["Is empty", "SequenceFunctions::isEmpty((1,2,3,4))", [false]],
    ["Is empty", "SequenceFunctions::isEmpty(null)", [true]],
    ["Not empty", "SequenceFunctions::notEmpty((1,2,3,4))", [true]],
    ["Not empty", "SequenceFunctions::notEmpty(null)", [false]],
    ["Size", "SequenceFunctions::size((1,2,3,4))", [4]],
    ["Size", "SequenceFunctions::size(null)", [0]],
])("%s (%s) can be evaluated", async (_: string, body: string, expected: unknown[]) => {
    await expectEvaluationResult({
        text:
            PACKAGE +
            `
        in feature a = ${body};
        `,
        langId: "kerml",
        result: expected,
    });
});
