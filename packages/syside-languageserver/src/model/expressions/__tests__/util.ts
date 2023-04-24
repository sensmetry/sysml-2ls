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

import { DeepPartial } from "langium";
import {
    NO_ERRORS,
    parseKerML,
    parseSysML,
    recursiveObjectContaining,
    sanitizeTree,
    services,
} from "../../../testing";
import { ElementMeta, FeatureMeta } from "../../KerML";
import { RangeGenerator } from "../range";
import { ExpressionResultValue } from "../util";

type EvaluationCase = {
    text: string;
    langId?: "kerml" | "sysml";
} & (
    | { result: DeepPartial<ExpressionResultValue>[] | unknown[] | RangeGenerator }
    | {
          error: {
              message?: unknown;
              stack?: DeepPartial<ElementMeta>[];
          };
      }
);

export async function expectEvaluationResult(test: EvaluationCase): Promise<void> {
    const result = await (test.langId === "kerml" ? parseKerML : parseSysML)(test.text, {
        ignoreMetamodelErrors: true,
        standalone: true,
        standardLibrary: "local",
        validationChecks: "none",
    });
    expect(result).toMatchObject(NO_ERRORS);

    const feature = result.value.members.at(-1)?.element?.$meta as FeatureMeta;
    expect(feature).toBeDefined();
    const expression = feature?.value?.element();
    expect(expression).toBeDefined();
    if (!expression) return;

    const value = sanitizeTree(services.shared.Evaluator.evaluate(expression, feature));
    if ("error" in test)
        expect(value).toMatchObject({
            ...test.error,
            stack: expect.arrayContaining(
                test.error.stack?.map((e) => recursiveObjectContaining(e)) ?? []
            ),
        });
    else expect(value).toMatchObject(test.result);
}
