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

import { defaultLinkingErrorTo } from "../../../../testing";

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
                    diagnostics: [defaultLinkingErrorTo("A")],
                }
            );
        });

        test("specializing classifiers is successful", async () => {
            return expect(
                `classifier A;
        classifier Child ${token} A;`
            ).toParseKerML({});
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
    }`).toParseKerML("snapshot");
});

test("classifiers can specialize multiple other classifiers", async () => {
    return expect(`
    classifier A;
    classifier B;
    classifier C specializes A, B;`).toParseKerML("snapshot");
});
