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

describe("elements are parseable without bodies", () => {
    test("with no names", async () => {
        return expect("element;").toParseKerML({
            elements: [{}],
        });
    });

    test("with name", async () => {
        return expect("element Any_;").toParseKerML({
            elements: [{ name: "Any_" }],
        });
    });

    test("with short name", async () => {
        return expect("element <any>;").toParseKerML({
            elements: [{ shortName: "any" }],
        });
    });

    test("with both names", async () => {
        return expect("element <'1.1'> Any;").toParseKerML({
            elements: [
                {
                    name: "Any",
                    shortName: "'1.1'",
                },
            ],
        });
    });

    // might be best to keep '' around unrestricted names, names could then be written as is when generating code from AST
    test("with unrestricted name", async () => {
        return expect("element 'arbitrary/ name+';").toParseKerML({
            elements: [{ name: "'arbitrary/ name+'" }],
        });
    });
});

// fixed the grammar to disallow nesting
test.failing("elements can be nested", async () => {
    return expect(`element A {
    element B {
        element C;
    }

    element D;
}`).toParseKerML({
        elements: [
            {
                name: "A",
                elements: [
                    {
                        name: "B",
                        elements: [{ name: "C" }],
                    },
                    {
                        name: "D",
                    },
                ],
            },
        ],
    });
});
