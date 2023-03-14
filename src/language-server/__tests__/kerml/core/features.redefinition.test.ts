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
    anything,
    parseKerML,
    NO_ERRORS,
    childrenNames,
} from "../../../../testing";
import { Redefinition, Feature } from "../../../generated/ast";
import { Visibility } from "../../../utils/scope-util";

test.concurrent.each(["redefines", ":>>"])(
    "redefinition can be parsed with '%s'",
    async (token: string) => {
        return expect(`
        feature a;
        feature b;
        specialization Redef redefinition a ${token} b {
            doc /* doc */
        }
    `).toParseKerML({
            relationshipMembers: [
                {
                    element: {
                        $type: Redefinition,
                        ...withQualifiedName("Redef"),
                        source: qualifiedTypeReference("a"),
                        reference: qualifiedTypeReference("b"),
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
    "redefinition without identification can be parsed with '%s'",
    async (prefix: string) => {
        return expect(`
        feature a;
        feature b;
        ${prefix} redefinition a :>> b;
    `).toParseKerML({
            relationshipMembers: [
                {
                    element: {
                        $type: Redefinition,
                        source: qualifiedTypeReference("a"),
                        reference: qualifiedTypeReference("b"),
                    },
                },
            ],
        });
    }
);

test("features can have multiple owned redefinitions", async () => {
    return expect(`
    feature a;
    feature b;
    feature c :>> a, b;`).toParseKerML({
        members: [
            ...anything(2),
            {
                element: {
                    $type: Feature,
                    ...withQualifiedName("c"),
                    typeRelationships: [
                        { $type: Redefinition, reference: qualifiedTypeReference("a") },
                        { $type: Redefinition, reference: qualifiedTypeReference("b") },
                    ],
                },
            },
        ],
    });
});

// TODO: inheritance and validation with redefined features, the spec is a little confusing

test("unnamed redefining features implicitly have the same name as the redefined feature", async () => {
    const result = await parseKerML(`
    class A {
        feature x;
    }
    class B specializes A {
        feature :>> x;
    }`);
    expect(result).toMatchObject(NO_ERRORS);
    expect(
        childrenNames(result.value.namespaceMembers[1].element, Visibility.private)
    ).toStrictEqual(["B::x", "B", "A"]);
});
