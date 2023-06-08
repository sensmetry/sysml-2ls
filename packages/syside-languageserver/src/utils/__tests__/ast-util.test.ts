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

import { Namespace, Package, Type } from "../../generated/ast";
import { childrenNames, directScopeNames, parseKerML, NO_ERRORS } from "../../testing";
import { formatString } from "typescript-string-operations";
import { stream } from "langium";

const N1 = `
namespace N1 {
    namespace A;
    protected namespace A2;
    private namespace A3;

    namespace N2 {
        namespace B;
        protected namespace B2;
        private namespace B3;
    }
}
`;

const N4 = `
namespace N4 {
    import N1::N2::B;

    namespace C;
}
`;

const N5 = `namespace N5 {
    import N1::N2::*;

    namespace C;
}
`;

const N6 = `namespace N6 {
    import N1::**;

    namespace C;
}
`;

const N7 = `namespace N7 {
    import N1::*::**;

    namespace C;
}
`;

test("membership imports only import the reference element", async () => {
    const result = await parseKerML(N1 + N4);
    expect(result).toMatchObject(NO_ERRORS);
    expect(childrenNames(result.value.children[1].element as Namespace)).toEqual([
        "N4::C",
        "N1::N2::B",
    ]);
});

test("namespace imports only import elements in the direct scope", async () => {
    const namespace = (await parseKerML(N1 + N5)).value;
    expect(childrenNames(namespace.children[1].element as Namespace)).toEqual([
        "N5::C",
        "N1::N2::B",
    ]);
});

test("recursive membership imports import namespaces recursively", async () => {
    const namespace = (await parseKerML(N1 + N6)).value;
    expect(childrenNames(namespace.children[1].element as Namespace)).toEqual([
        "N6::C",
        "N1",
        "N1::A",
        "N1::N2",
        "N1::N2::B",
    ]);
});

test("recursive namespace imports import namespaces recursively excluding the referenced namespace", async () => {
    const namespace = (await parseKerML(N1 + N7)).value;
    expect(childrenNames(namespace.children[1].element as Namespace)).toEqual([
        "N7::C",
        "N1::A",
        "N1::N2",
        "N1::N2::B",
    ]);
});

const InheritanceDoc = `
class A {
    feature a;
    protected feature b;
    private feature c;
}
class B {0} A {
    feature x;
    protected feature y;
    private feature z;
}
`;

test.concurrent.each(["specializes", "conjugates"])(
    "private members of base types are not inherited with %s",
    async (token: string) => {
        const result = await parseKerML(formatString(InheritanceDoc, token));
        expect(result).toMatchObject({ parserErrors: [], diagnostics: [], lexerErrors: [] });
        expect(directScopeNames(result.value.children[1].element as Namespace)).toEqual([
            "B::x",
            "B::y",
            "B::z",
            "A::a",
            "A::b",
        ]);
    }
);

test.concurrent.each(["specializes", "conjugates"])(
    "public inheritance visibility filters out protected inherited members with %s",
    async (token: string) => {
        const result = await parseKerML(formatString(InheritanceDoc, token));
        expect(result).toMatchObject({ parserErrors: [], diagnostics: [], lexerErrors: [] });
        expect(childrenNames(result.value.children[1].element as Namespace)).toEqual([
            "B::x",
            "A::a",
        ]);
    }
);

test("implicitly inherited members are visible", async () => {
    // not parsing the standard lib so fake Base::Anything here
    const result = await parseKerML(
        `
    package Base {
        abstract classifier Anything {
            feature x;
            protected feature y;
            private feature z;
        }
    }
    classifier A {
        feature a;
        protected feature b;
        private feature c;
    }`,
        {
            standardLibrary: "local",
            ignoreMetamodelErrors: true,
            standalone: true,
            validationChecks: "none",
        }
    );
    expect(result).toMatchObject(NO_ERRORS);
    expect(
        Array.from(
            stream((result.value.children[1].element as Type).$meta.types()).map(
                (t) => t.qualifiedName
            )
        )
    ).toEqual(["Base::Anything"]);
    expect(directScopeNames(result.value.children[1].element as Namespace)).toEqual([
        "A::a",
        "A::b",
        "A::c",
        "Base::Anything::x",
        "Base::Anything::y",
    ]);
});

test("redefined features are hidden", async () => {
    const result = await parseKerML(`
    class A {
        feature x;
    }
    class B specializes A {
        feature y redefines x;
    }
    class C specializes B {
        feature z redefines y; 
    }
    `);
    expect(result).toMatchObject(NO_ERRORS);
    expect(childrenNames(result.value.children[1].element as Namespace)).toEqual(["B::y"]);
    expect(childrenNames(result.value.children[2].element as Namespace)).toEqual(["C::z"]);
});

test("redefined features cannot be referenced by other elements", async () => {
    const result = await parseKerML(`
    type A { feature x; }
    type B specializes A {
        feature y redefines x;
        feature z redefines x;
    }
    `);
    expect(result).not.toMatchObject(NO_ERRORS);
});

test("circular imports are resolved without infinite loops", async () => {
    const result = await parseKerML(`
    package Circular {
        package P1 {
            import P2::*;
            class A;
        }
        package P2 {
            import P1::*;
            class B;
        }       
    }
    `);
    expect(result).toMatchObject(NO_ERRORS);
    const p1 = (result.value.children[0].element as Package).children[0].element as Package;
    expect(childrenNames(p1)).toEqual(["Circular::P1::A", "Circular::P2::B"]);
});

test("circular specializations are resolved without infinite loops", async () => {
    const result = await parseKerML(`
    type A :> B { feature a; protected b; private c; }
    type B :> A { feature x; protected y; private z; }
    `);
    expect(result).toMatchObject(NO_ERRORS);
    const a = result.value.children[0].element as Type;
    expect(directScopeNames(a)).toEqual(["A::a", "A::b", "A::c", "B::x", "B::y"]);
});
