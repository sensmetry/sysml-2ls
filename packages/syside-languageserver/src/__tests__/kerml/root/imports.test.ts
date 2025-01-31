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

const N1 = `namespace N1 {
    class A;
    class B;
    alias <C> CCC for B {
        doc /* alias doc */
    }
    private alias D for B;
}
`;
const N4 = `namespace N4 {
    class AA;
    class B;
    namespace M {
        class C;
    }
}
`;

test("namespace members can be imported with qualified names", async () => {
    return expect(
        N1 +
            `namespace N2 {
        import N1::A;
        import N1::C; // Imported with name "C"
        feature B : A;
        namespace M {
            import C; // "C" is re-imported from N2 into M;
        }
    }`
    ).toParseKerML();
});

test("wildcard imports all public members from a namespace", async () => {
    return expect(
        N1 +
            `namespace N3 {
        import N1::*;
        feature D : A;
        feature E : B;
    }`
    ).toParseKerML();
});

test("double wildcard recursively imports all members from a namespace and its children", async () => {
    return expect(
        N4 +
            `namespace N5 {
        import N4::**;
        // The above recursive import is equivalent to all
        // of the following taken together:
        // import N4;
        // import N4::*;
        // import N4::M::*;
    }
    namespace N6 {
        import N4::*::**;
        // The above recursive import is equivalent to all
        // of the following taken together:
        // import N4::*;
        // import N4::M::*;
        // (Note that N4 itself is not imported.)
        feature D : C; // N4::M::C
    }`
    ).toParseKerML();
});

test("visibility affects the visibility of imported members", async () => {
    return expect(
        N1 +
            N4 +
            `namespace N7 {
    public import N1::A {
        /* The imported membership is visible outside N7. */
    }
    private import N4::* {
        doc /* None of the imported memberships are visible
             * outside of N7. */
    }
    }
    feature A : N7::A;`
    ).toParseKerML();
});

test("imported elements can be filtered", async () => {
    // TODO: implement filtering
    return expect(`namespace Annotations {
        metaclass Approved;
    }
    namespace NA {
        class A {
            @Annotations::Approved;
        }
    }
    namespace N8 {
        import Annotations::*;
        // Only import elements of NA that are annotated as Approved.
        import NA::*[@Approved];
    }
    namespace N9 {
        import Annotations::*;
        import NA::*[not (@Approved)];
    }`).toParseKerML();
});
