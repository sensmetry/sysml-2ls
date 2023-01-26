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

import { formatString } from "typescript-string-operations";
import { anything, withQualifiedName, qualifiedTypeReference } from "../../../../testing";
import { Classifier, Feature, MultiplicityRange, LiteralInfinity } from "../../../generated/ast";

const Common = `
classifier Adult;
classifier Child;
`;

test("type can declare owned unioning, differencing and intersecting", async () => {
    return expect(
        Common +
            `
    classifier Person unions Adult, Child {
        feature dependents : Child[*];
        feature offspring : Person[*];
        feature grownOffspring : Adult[*] :> offspring;
        feature dependentOffspring : Child[*] :> dependents, offspring
            differences offspring, grownOffspring
            intersects dependents, offspring;
    }
    `
    ).toParseKerML({
        elements: [
            ...anything(2),
            {
                $type: Classifier,
                features: [
                    {
                        $type: Feature,
                        ...withQualifiedName("Person::dependents"),
                        typedBy: [qualifiedTypeReference("Child")],
                        multiplicity: {
                            $type: MultiplicityRange,
                            range: { $type: LiteralInfinity },
                        },
                    },
                    {
                        $type: Feature,
                        ...withQualifiedName("Person::offspring"),
                        typedBy: [qualifiedTypeReference("Person")],
                        multiplicity: {
                            $type: MultiplicityRange,
                            range: { $type: LiteralInfinity },
                        },
                    },
                    {
                        $type: Feature,
                        ...withQualifiedName("Person::grownOffspring"),
                        typedBy: [qualifiedTypeReference("Adult")],
                        subsets: [qualifiedTypeReference("Person::offspring")],
                        multiplicity: {
                            $type: MultiplicityRange,
                            range: { $type: LiteralInfinity },
                        },
                    },
                    {
                        $type: Feature,
                        ...withQualifiedName("Person::dependentOffspring"),
                        typedBy: [qualifiedTypeReference("Child")],
                        multiplicity: {
                            $type: MultiplicityRange,
                            range: { $type: LiteralInfinity },
                        },
                        subsets: [
                            qualifiedTypeReference("Person::dependents"),
                            qualifiedTypeReference("Person::offspring"),
                        ],
                        differences: [
                            qualifiedTypeReference("Person::offspring"),
                            qualifiedTypeReference("Person::grownOffspring"),
                        ],
                        intersects: [
                            qualifiedTypeReference("Person::dependents"),
                            qualifiedTypeReference("Person::offspring"),
                        ],
                    },
                ],
            },
        ],
    });
});

test("multiple relationships can be specified using multiple clauses", async () => {
    return expect(
        Common +
            `
    classifier Person unions Adult unions Child;`
    ).toParseKerML({
        elements: [
            ...anything(2),
            {
                $type: Classifier,
                ...withQualifiedName("Person"),
                unions: [qualifiedTypeReference("Adult"), qualifiedTypeReference("Child")],
            },
        ],
    });
});

test.concurrent.each(["unions", "intersects", "differences"])(
    "it is not allowable for a type to have just one of '%s' relationship",
    async (token: string) => {
        return expect(Common + formatString("classifier Person {0} Adult;", token)).toParseKerML(
            {},
            { diagnostics: anything(1) }
        );
    }
);
