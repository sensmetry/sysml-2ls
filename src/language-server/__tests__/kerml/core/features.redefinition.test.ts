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
import { Redefinition, Feature, Namespace } from "../../../generated/ast";
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
            relationships: [
                {
                    $type: Redefinition,
                    ...withQualifiedName("Redef"),
                    specific: qualifiedTypeReference("a"),
                    general: qualifiedTypeReference("b"),
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
    "redefinition without identification can be parsed with '%s'",
    async (prefix: string) => {
        return expect(`
        feature a;
        feature b;
        ${prefix} redefinition a :>> b;
    `).toParseKerML({
            relationships: [
                {
                    $type: Redefinition,
                    specific: qualifiedTypeReference("a"),
                    general: qualifiedTypeReference("b"),
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
        features: [
            ...anything(2),
            {
                $type: Feature,
                ...withQualifiedName("c"),
                redefines: [qualifiedTypeReference("a"), qualifiedTypeReference("b")],
            },
        ],
    });
});

// TODO: inheritance and validation with redefined features, the spec is a little confusing

test("unnamed redefining features implicitly have the same name as the redefined feature", async () => {
    const result = await parseKerML(`
    type A {
        feature x;
    }
    type B specializes A {
        feature :>> x;
    }`);
    expect(result).toMatchObject(NO_ERRORS);
    expect(childrenNames(result.value.elements[1] as Namespace, Visibility.private)).toStrictEqual([
        "B::x",
        "B",
        "A",
    ]);
});
