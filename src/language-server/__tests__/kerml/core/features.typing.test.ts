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

import {
    withQualifiedName,
    qualifiedTypeReference,
    parseKerML,
    sanitizeTree,
} from "../../../../testing";
import { FeatureTyping } from "../../../generated/ast";
import { SpecializationKind } from "../../../model";

test.concurrent.each(["typed by", ":"])(
    "feature typings can be parsed with '%s'",
    async (token: string) => {
        return expect(`
        feature customer;
        type Person;
        specialization t typing customer ${token} Person {
            doc /* doc */
        }
    `).toParseKerML({
            relationships: [
                {
                    $type: FeatureTyping,
                    ...withQualifiedName("t"),
                    specific: qualifiedTypeReference("customer"),
                    general: qualifiedTypeReference("Person"),
                    docs: [
                        {
                            body: "/* doc */",
                        },
                    ],
                },
            ],
        });
    }
);

test.concurrent.each(["specialization", ""])(
    "feature typing without identification can be parsed with '%s'",
    async (prefix: string) => {
        return expect(`
        feature customer;
        type Person;
        ${prefix} typing customer : Person;
    `).toParseKerML({
            relationships: [
                {
                    $type: FeatureTyping,
                    specific: qualifiedTypeReference("customer"),
                    general: qualifiedTypeReference("Person"),
                },
            ],
        });
    }
);

test("features typed by aliases resolve to aliased types", async () => {
    const text = `
        type A;
        alias B for A;
        feature a : B;
    `;

    const result = await parseKerML(text);
    expect(result).toParseKerML({
        features: [
            {
                ...withQualifiedName("a"),
                typedBy: [qualifiedTypeReference("A")],
            },
        ],
    });

    const typings = Array.from(
        result.value.features[0].$meta.specializations(SpecializationKind.Typing)
    );

    expect(typings).toHaveLength(1);
    expect(sanitizeTree(typings[0].type)).toMatchObject(withQualifiedName("A"));
});
