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
import { InlineExpression } from "../../../generated/ast";

const Evaluator = services.shared.modelLevelExpressionEvaluator;
const PACKAGE = `
package NumericalFunctions {
    abstract function product;
    abstract function sum;
}
`;

test.concurrent.each([
    ["Product", "NumericalFunctions::product((1,2,3,4))", [24]],
    ["Product", "NumericalFunctions::product(4)", [4]],
    ["Sum", "NumericalFunctions::sum((1,2,3,4))", [10]],
    ["Sum", "NumericalFunctions::sum(4)", [4]],
])("%s (%s) can be evaluated", async (_: string, body: string, expected: unknown[]) => {
    const result = await parseKerML(`feature a = ${body};` + PACKAGE);
    expect(result).toMatchObject(NO_ERRORS);

    const expression = result.value.features[0].value?.expression;
    expect(expression).not.toBeUndefined();
    expect(
        Evaluator.evaluate(expression as InlineExpression, result.value.features[0])
    ).toMatchObject(expected);
});
