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

import { services, parseKerML, NO_ERRORS } from "../../../../testing";

const Evaluator = services.shared.modelLevelExpressionEvaluator;

test.concurrent.each([
    ["And", "true & false", [false]],
    ["And", "true & true", [true]],
    ["And", "false & true", [false]],
    ["And", "false & false", [false]],
    ["Or", "true | false", [true]],
    ["Or", "true | true", [true]],
    ["Or", "false | true", [true]],
    ["Or", "false | false", [false]],
    ["Xor", "true xor false", [true]],
    ["Xor", "true xor true", [false]],
    ["Xor", "false xor true", [true]],
    ["Xor", "false xor false", [false]],
    ["Not", "not true", [false]],
    ["Not", "not false", [true]],
])("%s (%s) can be evaluated", async (_: string, body: string, expected: unknown[]) => {
    const result = await parseKerML(`feature a = ${body};`);
    expect(result).toMatchObject(NO_ERRORS);

    const feature = result.value.features[0].$meta;
    const expression = feature.value?.element;
    expect(expression).not.toBeUndefined();
    if (!expression) return;
    expect(Evaluator.evaluate(expression, feature)).toMatchObject(expected);
});
