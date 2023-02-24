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
import { services, parseKerML, NO_ERRORS } from "../../../../testing";

const Evaluator = services.shared.modelLevelExpressionEvaluator;
const PACKAGE = `
package StringFunctions {
    ${["Length", "Substring"].map((f) => "abstract function " + f).join(";\n\t")};
}
`;

test.concurrent.each([
    ["Length", 'StringFunctions::Length("string")', [6]],
    ["Length", 'StringFunctions::Length("")', [0]],
    ["Length", "StringFunctions::Length(null)", undefined],
    ["Substring", 'StringFunctions::Substring("string", 1, 4)', ["stri"]],
    ["Substring", 'StringFunctions::Substring("string", 3, 4)', ["ri"]],
])("%s (%s) can be evaluated", async (_: string, body: string, expected: unknown[] | undefined) => {
    const result = await parseKerML(`feature a = ${body};` + PACKAGE);
    expect(result).toMatchObject(NO_ERRORS);

    const feature = result.value.features[0].$meta;
    const expression = feature.value?.element;
    expect(expression).not.toBeUndefined();
    if (!expression) return;
    const exprResult = Evaluator.evaluate(expression, feature);
    if (expected) expect(exprResult).toMatchObject(expected);
    else expect(exprResult).toBeUndefined();
});
