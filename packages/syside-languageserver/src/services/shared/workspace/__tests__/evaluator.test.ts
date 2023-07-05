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
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { parseKerML, parseSysML, services } from "../../../../testing";
import { Feature } from "../../../../generated/ast";
import { ElementMeta, Evaluable, ExpressionResultValue } from "../../../../model";
import { ExpressionError, SysMLExpressionEvaluator } from "../../evaluator";

type CaseDescription = {
    type: string;
    method: (expression: Evaluable, target: ElementMeta) => ExpressionError | ExpressionResultValue;
};

type Case = (
    | {
          kerml: string;
      }
    | { sysml: string }
) & { expect: (value: ExpressionError | ExpressionResultValue) => void; index?: number };
type Cases = Record<string, Case>;

function expectError(message: string | RegExp): Case["expect"] {
    return (value) =>
        expect(value).toMatchObject({
            message: expect.stringMatching(message),
        });
}

describe.each<{ description: CaseDescription; cases: Cases }>([
    {
        description: {
            type: "number",
            method: SysMLExpressionEvaluator.prototype.evaluateNumber,
        },
        cases: {
            nan: {
                kerml: "feature a = ();",
                expect: (value) => expect(value).toBeNaN(),
            },
            single: {
                kerml: "feature a = 42;",
                expect: (value) => expect(value).toEqual(42),
            },
            "bad type": {
                kerml: 'feature a = "42";',
                expect: expectError(/not a number/i),
            },
            "too many values": {
                kerml: "feature a = (42, 42);",
                expect: expectError(/too many values/i),
            },
        },
    },
    {
        description: {
            type: "string",
            method: SysMLExpressionEvaluator.prototype.evaluateString,
        },
        cases: {
            "not enough values": {
                kerml: "feature a = ();",
                expect: expectError(/not enough values/i),
            },
            single: {
                kerml: 'feature a = "42";',
                expect: (value) => expect(value).toEqual("42"),
            },
            "bad type": {
                kerml: 'feature a = 42";',
                expect: expectError(/not a string/i),
            },
            "too many values": {
                kerml: `feature a = ("42", "42");`,
                expect: (value) =>
                    expect(value).toMatchObject({
                        message: expect.stringMatching(/too many values/i),
                    }),
            },
        },
    },
    {
        description: {
            type: "boolean",
            method: SysMLExpressionEvaluator.prototype.evaluateBoolean,
        },
        cases: {
            "not enough values": {
                kerml: "feature a = ();",
                expect: expectError(/not enough values/i),
            },
            single: {
                kerml: "feature a = true;",
                expect: (value) => expect(value).toBeTruthy(),
            },
            "bad type": {
                kerml: 'feature a = 42";',
                expect: expectError(/not a boolean/i),
            },
            "too many values": {
                kerml: `feature a = (true, false);`,
                expect: (value) =>
                    expect(value).toMatchObject({
                        message: expect.stringMatching(/too many values/i),
                    }),
            },
        },
    },
])("$description.type evaluation", ({ description, cases }) => {
    test.each(Object.entries(cases))("%s", async (_, testCase) => {
        const tree = await ("kerml" in testCase
            ? parseKerML(testCase.kerml)
            : parseSysML(testCase.sysml));
        const feature = (tree.value.children.at(testCase.index ?? 0)?.target as Feature | undefined)
            ?.$meta;

        expect(feature).toBeDefined();
        if (!feature) return;

        const expr = feature.value?.element();
        expect(expr).toBeDefined();
        if (!expr) return;

        const evaluator = new SysMLExpressionEvaluator(services.shared);
        const value = description.method.call(evaluator, expr, feature);

        testCase.expect(value);
    });
});
