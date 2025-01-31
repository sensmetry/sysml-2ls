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
import { LiteralInfinity } from "../../../generated/ast";
import { RangeGenerator } from "../range";
import { expectEvaluationResult } from "./util";

test.concurrent.each([
    ["Literal number", "15", [15]],
    ["Literal number", "15.4", [15.4]],
    ["Literal number", "5e-1", [0.5]],
    ["Literal number", "5e2", [500]],
    ["Literal boolean", "true", [true]],
    ["Literal boolean", "false", [false]],
    ["Literal string", '"string"', ["string"]],
    ["Literal infinity", "*", [{ $type: LiteralInfinity }]],
    ["Division", "10 / 5", [2]],
    ["Modulo", "5 % 2", [1]],
    ["Multiplication", "5 * 2", [10]],
    ["Greater than", "5 > 2", [true]],
    ["Greater than", "2 > 5", [false]],
    ["Greater than or equal", '"s12" > "s1"', [true]],
    ["Greater than or equal", '"s1" > "s12"', [false]],
    ["Greater than or equal", "5 >= 2", [true]],
    ["Greater than or equal", "2 >= 5", [false]],
    ["Greater than or equal", "5 >= 5", [true]],
    ["Greater than or equal", '"s1" >= "s1"', [true]],
    ["Greater than", "5 < 2", [false]],
    ["Greater than", "2 < 5", [true]],
    ["Greater than", "2 == 5", [false]],
    ["Greater than", "2 === 5", [false]],
    ["Greater than", "2 !== 5", [true]],
    ["Greater than or equal", '"s12" < "s1"', [false]],
    ["Greater than or equal", '"s1" < "s12"', [true]],
    ["Greater than or equal", "5 <= 2", [false]],
    ["Greater than or equal", "2 <= 5", [true]],
    ["Greater than or equal", "5 <= 5", [true]],
    ["Greater than or equal", '"s1" <= "s1"', [true]],
    ["Subtraction", "5 - 3", [2]],
    ["Unary minus", "-3", [-3]],
    ["Addition", "5 + 3", [8]],
    ["Unary plus", "+3", [3]],
    ["String addition", '"s1" + "s2"', ["s1s2"]],
    ["Exponentiation", "2 ** 3", [8]],
    ["Exponentiation", "2 ^ 3", [8]],
    ["Range", "0..3", new RangeGenerator({ start: 0, stop: 3 })],
])(
    "%s (%s) can be evaluated",
    async (_: string, body: string, expected: unknown[] | RangeGenerator) => {
        await expectEvaluationResult({
            text: `in feature a = ${body};`,
            langId: "kerml",
            result: expected,
        });
    }
);
