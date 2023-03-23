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

import { withQualifiedName, qualifiedTypeReference } from "../../../../testing";
import { Subsetting } from "../../../generated/ast";

test.concurrent.each(["subsets", ":>"])(
    "subsetting can be parsed with '%s'",
    async (token: string) => {
        return expect(`
        feature parent;
        feature person;
        specialization Sub subset parent ${token} person {
            doc /* doc */
        }
    `).toParseKerML({
            relationshipMembers: [
                {
                    element: {
                        $type: Subsetting,
                        ...withQualifiedName("Sub"),
                        source: qualifiedTypeReference("parent"),
                        reference: qualifiedTypeReference("person"),
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
    "subsetting without identification can be parsed with '%s'",
    async (prefix: string) => {
        return expect(`
        feature parent;
        feature person;
        ${prefix} subset parent :> person;
    `).toParseKerML({
            relationshipMembers: [
                {
                    element: {
                        $type: Subsetting,
                        source: qualifiedTypeReference("parent"),
                        reference: qualifiedTypeReference("person"),
                    },
                },
            ],
        });
    }
);
