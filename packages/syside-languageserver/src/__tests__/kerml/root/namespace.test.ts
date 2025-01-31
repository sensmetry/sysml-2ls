/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
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

import { Comment } from "../../../generated/ast";
import { anything, parsedNode } from "../../../testing";

test("namespaces are parseable", async () => {
    return expect(`namespace <'1.1'> N1; // This is an empty namespace.
    namespace <'1.2'> N2 {
    doc /* This is an example of a namespace body. */
    class C;
    datatype D;
    feature f : C;
    namespace N3; // This is a nested namespace.
    }`).toParseKerML();
});

test("namespace elements visibility is parsed", async () => {
    return expect(`namespace N {
        public class C;
        private datatype D;
        protected feature f : C;
    }`).toParseKerML({
        children: [
            {
                target: {
                    children: [
                        { visibility: "public" },
                        { visibility: "private" },
                        { visibility: "protected" },
                    ],
                },
            },
        ],
    });
});

test("aliases are parseable", async () => {
    return expect(`namespace N1 {
        class A;
        class B;
        alias <C> CCC for B {
            doc /* alias doc */
        }
        private alias D for B;
    }`).toParseKerML();
});

test("namespaces can have comments", async () => {
    return expect(
        parsedNode(
            `namespace N9 {
    class A;
    comment Comment1 about A
        /* comment about A */
    comment Comment2
        /* comment about N9 */
    /* also comment about N9 */
    doc N9_Doc
        /* doc about N9 */
    }`,
            { node: Comment, index: 2 }
        )
    ).resolves.toMatchObject({ body: "/* also comment about N9 */" });
});

test("all top-level elements are in the root namespace", async () => {
    return expect(`doc /* root doc */
    class A;
    class C;
    datatype D;
    feature f: C;
    package P;
    `).toParseKerML({ children: anything(6) });
});
