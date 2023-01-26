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

import { anything, withQualifiedName, qualifiedTypeReference } from "../../../../testing";
import { Classifier, Feature, MultiplicityRange, LiteralInfinity } from "../../../generated/ast";

test("features can be parsed and aliased", async () => {
    return expect(`
    datatype Integer;
    feature person[*] : Person;
    classifier Person {
        feature age[1]: Integer;
        alias personAlias for person;
    }`).toParseKerML({
        elements: [
            ...anything(1),

            {
                $type: Classifier,
                ...withQualifiedName("Person"),
                features: [
                    {
                        $type: Feature,
                        ...withQualifiedName("Person::age"),
                        typedBy: [qualifiedTypeReference("Integer")],
                    },
                ],
                aliases: [
                    {
                        ...withQualifiedName("Person::personAlias"),
                        for: qualifiedTypeReference("person"),
                    },
                ],
            },
        ],
        features: [
            {
                $type: Feature,
                ...withQualifiedName("person"),
                typedBy: [qualifiedTypeReference("Person")],
                multiplicity: { $type: MultiplicityRange, range: { $type: LiteralInfinity } },
            },
        ],
    });
});

test("member features can be parsed", async () => {
    return expect(`
    classifier A;
    classifier B {
        feature f;
        member feature g featured by A;
    }`).toParseKerML({
        elements: [
            ...anything(1),
            {
                $type: Classifier,
                features: [
                    {
                        $type: Feature,
                        ...withQualifiedName("B::f"),
                    },
                ],
                members: [
                    {
                        $type: Feature,
                        ...withQualifiedName("B::g"),
                        featuredBy: [qualifiedTypeReference("A")],
                    },
                ],
            },
        ],
    });
});
