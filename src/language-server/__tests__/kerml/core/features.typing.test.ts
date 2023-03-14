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
import { Feature, FeatureTyping } from "../../../generated/ast";

test.concurrent.each(["typed by", ":"])(
    "feature typings can be parsed with '%s'",
    async (token: string) => {
        return expect(`
        feature customer;
        class Person;
        specialization t typing customer ${token} Person {
            doc /* doc */
        }
    `).toParseKerML({
            relationshipMembers: [
                {
                    element: {
                        $type: FeatureTyping,
                        ...withQualifiedName("t"),
                        source: qualifiedTypeReference("customer"),
                        reference: qualifiedTypeReference("Person"),
                        annotations: [
                            {
                                element: {
                                    body: "/* doc */",
                                },
                            },
                        ],
                    },
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
        class Person;
        ${prefix} typing customer : Person;
    `).toParseKerML({
            relationshipMembers: [
                {
                    element: {
                        $type: FeatureTyping,
                        source: qualifiedTypeReference("customer"),
                        reference: qualifiedTypeReference("Person"),
                    },
                },
            ],
        });
    }
);

test("features typed by aliases resolve to aliased types", async () => {
    const text = `
        class A;
        alias B for A;
        feature a : B;
    `;

    const result = await parseKerML(text);
    expect(result).toParseKerML({
        members: [
            {
                element: {
                    ...withQualifiedName("a"),
                    typeRelationships: [{ reference: qualifiedTypeReference("A") }],
                },
            },
        ],
    });

    const typings = Array.from(
        (result.value.members[0].element as Feature).$meta.specializations(FeatureTyping)
    );

    expect(typings).toHaveLength(1);
    expect(sanitizeTree(typings[0].element()?.ast(), undefined, "include $meta")).toMatchObject(
        withQualifiedName("A")
    );
});
