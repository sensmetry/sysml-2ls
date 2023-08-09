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

import { Classifier } from "../../../generated/ast";
import { anything, defaultLinkingErrorTo, parsedNode, qualifiedTarget } from "../../../testing";

describe.each(["specializes", "conjugates"])(
    "classifiers can only specialize other classifiers with '%s'",
    (token: string) => {
        test("specializing non-classifiers issues a diagnostic", async () => {
            return expect(
                `namespace A;
        classifier Child ${token} A;`
            ).toParseKerML(
                {},
                {
                    diagnostics: [defaultLinkingErrorTo("A"), ...anything(1)],
                    buildOptions: { validationChecks: "all", standardLibrary: "none" },
                }
            );
        });

        test("specializing classifiers is successful", async () => {
            return expect(
                parsedNode(
                    `classifier A;
        classifier Child ${token} A;`,
                    { node: Classifier, index: 1, build: true }
                )
            ).resolves.toMatchObject({
                heritage: [{ targetRef: qualifiedTarget("A") }],
            });
        });
    }
);

test("specializations can be parsed", async () => {
    return expect(`
    classifier A;
    classifier B;
    specialization Super subclassifier A specializes B;
    specialization subclassifier B :> A {
        doc /* unnamed */
    }`).toParseKerML();
});

test("classifiers can specialize multiple other classifiers", async () => {
    return expect(
        parsedNode(
            `
    classifier A;
    classifier B;
    classifier C specializes A, B;`,
            { node: Classifier, index: 2 }
        )
    ).resolves.toMatchObject({ heritage: anything(2) });
});
