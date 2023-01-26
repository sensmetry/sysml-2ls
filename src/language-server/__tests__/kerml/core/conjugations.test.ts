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
import { withQualifiedName, qualifiedTypeReference, anything } from "../../../../testing";
import { Conjugation, Documentation } from "../../../generated/ast";

const Common = `
type Original {
    in feature Input;
}
type Conjugate1;
type Conjugate2;
`;

test("conjugation can be parsed", async () => {
    return expect(
        Common +
            `
    conjugation c1 conjugate Conjugate1 conjugates Original;
    conjugation c2 conjugate Conjugate2 ~ Original {
        doc /* same as c1 */
    }`
    ).toParseKerML({
        relationships: [
            {
                $type: Conjugation,
                ...withQualifiedName("c1"),
                specific: qualifiedTypeReference("Conjugate1"),
                general: qualifiedTypeReference("Original"),
            },
            {
                $type: Conjugation,
                ...withQualifiedName("c2"),
                specific: qualifiedTypeReference("Conjugate2"),
                general: qualifiedTypeReference("Original"),
                docs: [
                    {
                        $type: Documentation,
                        body: "/* same as c1 */",
                    },
                ],
            },
        ],
    });
});

test.concurrent.each(["conjugates", "~"])(
    "conjugation may be omitted without identifiers with '%s'",
    async (token: string) => {
        return expect(
            formatString(
                Common +
                    `
    conjugate Conjugate1 {0} Original;`,
                token
            )
        ).toParseKerML({
            relationships: [
                {
                    $type: Conjugation,
                    specific: qualifiedTypeReference("Conjugate1"),
                    general: qualifiedTypeReference("Original"),
                },
            ],
        });
    }
);

test.concurrent.each(["conjugates", "~"])(
    "type can declare owned conjugations with '%s'",
    async (token: string) => {
        return expect(
            formatString(
                `
    type Original;
    type Conjugate1 {0} Original;`,
                token
            )
        ).toParseKerML({
            elements: [
                ...anything(1),
                {
                    ...withQualifiedName("Conjugate1"),
                    conjugates: [qualifiedTypeReference("Original")],
                },
            ],
        });
    }
);
