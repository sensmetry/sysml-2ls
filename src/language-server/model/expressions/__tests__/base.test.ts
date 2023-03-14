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

import { services, parseKerML, NO_ERRORS, sanitizeTree } from "../../../../testing";
import { FeatureMeta } from "../../KerML";

const Evaluator = services.shared.modelLevelExpressionEvaluator;

test.concurrent.each([
    ["Cast", "B as A", [{ qualifiedName: "B" }]],
    ["Cast", "C as A", [{ qualifiedName: "C" }]],
    ["Cast", "A as B", []],
    ["Metacast", "B meta M", [{ qualifiedName: "B::Meta" }, { qualifiedName: "B::Meta2" }]],
    ["Metacast", "C meta M", [{ qualifiedName: "B::Meta" }, { qualifiedName: "B::Meta2" }]],
    ["Metacast", "A meta M", []],
    ["Classification test", "B @ A", [true]],
    ["Classification test", "C @ A", [true]],
    ["Classification test", "A @ B", [false]],
    ["Metaclassification test", "B @@ M", [true]],
    ["Metaclassification test", "C @@ M", [true]],
    ["Metaclassification test", "A @@ M", [false]],
    ["Equality", "A == B", [false]],
    ["Equality", "A === B", [false]],
    ["Equality", "A == A", [true]],
    ["Equality", "A === A", [true]],
    ["Inequality", "A !== A", [false]],
    ["Inequality", "A != A", [false]],
    ["Inequality", "A != B", [true]],
    ["Inequality", "A !== B", [true]],
    ["Has type", "B hastype A", [true]],
    ["Has type", "C hastype A", [false]],
    ["Is type", "B istype A", [true]],
    ["Is type", "C istype A", [true]],
    ["Is type", "A istype B", [false]],
    // Yay for 1-based indexing.............
    ["Indexing", "(B meta M)[1]", [{ qualifiedName: "B::Meta" }]],
    ["Indexing", "(B meta M)[2]", [{ qualifiedName: "B::Meta2" }]],
    ["Sequence", "(1,2,3,4)", [1, 2, 3, 4]],
    ["Sequence", "(1,2,3,A)", [1, 2, 3, { qualifiedName: "A" }]],
])("%s (%s) can be evaluated", async (_: string, body: string, expected: unknown[] | undefined) => {
    const result = await parseKerML(
        `feature a = ${body}; feature A; feature B : A { @Meta: M; @Meta2: M; } feature C : B; metaclass M;`
    );
    expect(result).toMatchObject(NO_ERRORS);

    const feature = result.value.members[0].element?.$meta as FeatureMeta;
    const expression = feature.value?.element();
    expect(expression).not.toBeUndefined();
    if (!expression) return;

    const exprResult = Evaluator.evaluate(expression, feature);
    if (expected) expect(sanitizeTree(exprResult)).toMatchObject(expected);
    else expect(sanitizeTree(exprResult)).toBeUndefined();
});
