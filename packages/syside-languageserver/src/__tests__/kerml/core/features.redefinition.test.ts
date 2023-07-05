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
} from "../../../testing";
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
            children: [
                ...anything(2),
                {
                    target: {
                        $type: Redefinition,
                        ...withQualifiedName("Redef"),
                        sourceRef: qualifiedTypeReference("a"),
                        targetRef: qualifiedTypeReference("b"),
                        elements: [
                            {
                                source: {
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
            children: [
                ...anything(2),
                {
                    target: {
                        $type: Redefinition,
                        sourceRef: qualifiedTypeReference("a"),
                        targetRef: qualifiedTypeReference("b"),
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
        children: [
            ...anything(2),
            {
                target: {
                    $type: Feature,
                    ...withQualifiedName("c"),
                    heritage: [
                        { $type: Redefinition, targetRef: qualifiedTypeReference("a") },
                        { $type: Redefinition, targetRef: qualifiedTypeReference("b") },
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
    expect(childrenNames(result.value.children[1].target, Visibility.private)).toStrictEqual([
        "B::x",
    ]);
});
