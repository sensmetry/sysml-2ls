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
        return expect("class;").toParseKerML("snapshot");
    });

    test("with name", async () => {
        return expect("class Any_;").toParseKerML("snapshot");
    });

    test("with short name", async () => {
        return expect("class <any>;").toParseKerML("snapshot");
    });

    test("with both names", async () => {
        return expect("class <'1.1'> Any;").toParseKerML("snapshot");
    });

    // might be best to keep '' around unrestricted names, names could then be written as is when generating code from AST
    test("with unrestricted name", async () => {
        return expect("class 'arbitrary/ name+';").toParseKerML("snapshot");
    });
});

test("elements can be nested", async () => {
    return expect(`class A {
    class B {
        class C;
    }

    class D;
}`).toParseKerML("snapshot");
});
