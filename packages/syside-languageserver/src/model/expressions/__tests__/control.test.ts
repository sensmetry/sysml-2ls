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

test.concurrent.each([
    ["And", "true and false", [false]],
    ["And", "true and true", [true]],
    ["And", "false and true", [false]],
    ["And", "false and false", [false]],
    ["Implies", "true implies false", [false]],
    ["Implies", "true implies true", [true]],
    ["Implies", "false implies true", [true]],
    ["Implies", "false implies false", [true]],
    ["Or", "true or false", [true]],
    ["Or", "true or true", [true]],
    ["Or", "false or true", [true]],
    ["Or", "false or false", [false]],
    ["If", "if true ? 1 else 2", [1]],
    ["If", "if false ? 1 else 2", [2]],
    ["Null coalescing", "null ?? 1", [1]],
])("%s (%s) can be evaluated", async (_: string, body: string, expected: unknown[]) => {
    await expectEvaluationResult({
        text: `in feature a = ${body};`,
        langId: "kerml",
        result: expected,
    });
});

test("Feature chain expressions can be evaluated", async () => {
    await expectEvaluationResult({
        text: `
            feature a {
                feature b = 42;
            }
            feature c = a.b;
        `,
        langId: "kerml",
        result: [42],
    });
});
