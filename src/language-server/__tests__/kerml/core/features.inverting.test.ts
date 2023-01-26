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

import { withQualifiedName, qualifiedTypeReference, anything } from "../../../../testing";
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
        relationships: [
            {
                $type: FeatureInverting,
                ...withQualifiedName("parent_child"),
                invertingFeature: qualifiedTypeReference("Person::child"),
                featureInverted: qualifiedTypeReference("Person::parent"),
                docs: [
                    {
                        body: "/* doc */",
                    },
                ],
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
            relationships: [
                {
                    $type: FeatureInverting,
                    invertingFeature: qualifiedTypeReference("Person::child"),
                    featureInverted: qualifiedTypeReference("Person::parent"),
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
        elements: [
            {
                features: [
                    ...anything(1),
                    {
                        $type: Feature,
                        ...withQualifiedName("Person::parents"),
                        inverseOf: [qualifiedTypeReference("Person::children")],
                    },
                ],
            },
        ],
    });
});

test("inverse features can be arbitrarily nested", async () => {
    return expect(`
    type B;
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
        elements: [
            ...anything(2),
            {
                $type: Classifier,
                ...withQualifiedName("C"),
                features: [
                    {
                        ...withQualifiedName("C::b"),
                        features: [
                            {
                                ...withQualifiedName("C::b::a"),
                                inverseOf: [qualifiedTypeReference("A::b::c")],
                            },
                        ],
                    },
                ],
            },
        ],
    });
});
