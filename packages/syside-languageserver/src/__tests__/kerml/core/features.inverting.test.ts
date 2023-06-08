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

import { withQualifiedName, qualifiedTypeReference, anything } from "../../../testing";
import { FeatureInverting, Feature, Classifier } from "../../../generated/ast";

test("feature inverting can be parsed", async () => {
    return expect(`
        classifier Person {
            feature child: Person;
            feature parent: Person;
        }
        inverting parent_child inverse Person::parent of Person::child {
            doc /* doc */
        }
    `).toParseKerML({
        children: [
            ...anything(1),
            {
                element: {
                    $type: FeatureInverting,
                    ...withQualifiedName("parent_child"),
                    source: qualifiedTypeReference("Person::parent"),
                    reference: qualifiedTypeReference("Person::child"),
                    elements: [
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
});

test.concurrent.each(["inverting", ""])(
    "feature inverting without identification can be parsed with '%s'",
    async (prefix: string) => {
        return expect(`
        classifier Person {
            feature child: Person;
            feature parent: Person;
        }
        ${prefix} inverse Person::parent of Person::child;
    `).toParseKerML({
            children: [
                ...anything(1),
                {
                    element: {
                        $type: FeatureInverting,
                        source: qualifiedTypeReference("Person::parent"),
                        reference: qualifiedTypeReference("Person::child"),
                    },
                },
            ],
        });
    }
);

test("features can own invertings", async () => {
    return expect(`
    classifier Person {
        feature children : Person[*];
        feature parents: Person[*] inverse of children;
    }`).toParseKerML({
        children: [
            {
                element: {
                    children: [
                        ...anything(1),
                        {
                            element: {
                                $type: Feature,
                                ...withQualifiedName("Person::parents"),
                                typeRelationships: [
                                    {
                                        $type: FeatureInverting,
                                        reference: qualifiedTypeReference("Person::children"),
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        ],
    });
});

test("inverse features can be arbitrarily nested", async () => {
    return expect(`
    class B;
    classifier A {
        feature b : B {
            feature c : C;
        }
    }
    classifier C {
        feature b : B {
            feature a: A inverse of A::b::c;
        }
    }`).toParseKerML({
        children: [
            ...anything(2),
            {
                element: {
                    $type: Classifier,
                    ...withQualifiedName("C"),
                    children: [
                        {
                            element: {
                                ...withQualifiedName("C::b"),
                                children: [
                                    {
                                        element: {
                                            ...withQualifiedName("C::b::a"),
                                            typeRelationships: [
                                                {
                                                    $type: FeatureInverting,
                                                    reference: qualifiedTypeReference("A::b::c"),
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        ],
    });
});
