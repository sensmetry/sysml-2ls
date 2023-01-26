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

import { Type } from "langium/lib/grammar/generated/ast";
import { qualifiedTypeReference, anything, withQualifiedName } from "../../../../testing";
import { Specialization, Documentation } from "../../../generated/ast";

const Common = `
type A;
type B;
`;

test("specialization can be parsed", async () => {
    return expect(
        Common +
            `
    type x;
    classifier things;
    specialization Gen subtype A specializes B;
    specialization subtype x :> things {
        doc /* unnamed */
    }`
    ).toParseKerML({
        relationships: [
            {
                $type: Specialization,
                specific: qualifiedTypeReference("A"),
                general: qualifiedTypeReference("B"),
            },
            {
                $type: Specialization,
                specific: qualifiedTypeReference("x"),
                general: qualifiedTypeReference("things"),
                docs: [
                    {
                        $type: Documentation,
                        body: "/* unnamed */",
                    },
                ],
            },
        ],
    });
});

test("types can specialize multiple types", async () => {
    return expect(
        Common +
            `
    type C specializes A, B;`
    ).toParseKerML({
        elements: [
            ...anything(2),
            {
                $type: Type,
                ...withQualifiedName("C"),
                specializes: [qualifiedTypeReference("A"), qualifiedTypeReference("B")],
            },
        ],
    });
});
