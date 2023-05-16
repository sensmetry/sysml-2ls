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

import { getDocument, Stream } from "langium";
import { parseKerML, parseSysML, TEST_BUILD_OPTIONS } from "../../testing";
import { GlobalScope } from "../global-scope";
import { NamespaceScope } from "../scopes";

const SaneKerML = "package <k1> K1; private package K2;";
const SaneSysML = "package S1; package K1;";
const BadKerML_import = "package A { package B; } import A::*;";
const BadSysML_import = "package A { package B; } import C::*;";
const BadKerML_feature = "package A { feature a; } feature :>> A::a;";

const BUILD_OPTIONS = {
    ...TEST_BUILD_OPTIONS,
    document: true,
} as const;

class TestScope extends GlobalScope {
    override getDynamicExports(langId?: string | undefined): Stream<NamespaceScope> {
        return super.getDynamicExports(langId);
    }
}

describe("Global scope", () => {
    let scope: TestScope;

    beforeEach(() => (scope = new TestScope()));

    it("should find static global symbols by name", async () => {
        const kerml = await parseKerML(SaneKerML, BUILD_OPTIONS);
        const sysml = await parseSysML(SaneSysML, BUILD_OPTIONS);

        scope.collectDocument(kerml);
        scope.collectDocument(sysml);

        expect(
            scope.getExportedElement("K1", ".sysml")?.parent().ast()?.$document?.uriString
        ).toStrictEqual(sysml.uriString);
        expect(
            scope.getExportedElement("K1", ".kerml")?.parent().ast()?.$document?.uriString
        ).toStrictEqual(kerml.uriString);
        expect(scope.getExportedElement("k1")).toBeDefined();
        expect(scope.getExportedElement("K2")).toBeUndefined();
        expect(scope.getExportedElement("S1", ".kerml")).toBeDefined();
    });

    it("should find dynamically imported global symbols by name", async () => {
        const kerml = await parseKerML(BadKerML_import, BUILD_OPTIONS);

        scope.collectDocument(kerml);

        expect(scope.getExportedElement("A")).toBeDefined();
        expect(scope.getExportedElement("B")).toBeDefined();
        expect(scope.getExportedElement("AB")).toBeUndefined();
    });

    it("should find dynamically named global features by name", async () => {
        const kerml = await parseKerML(BadKerML_feature, BUILD_OPTIONS);

        scope.collectDocument(kerml);

        expect(scope.getExportedElement("A")).toBeDefined();
        expect(scope.getExportedElement("a")).toBeDefined();
        expect(scope.getExportedElement("b")).toBeUndefined();
    });

    it("should not add dynamic exports if imports are not public", async () => {
        const kerml = await parseKerML(
            "package A { package B; } protected import A::B;",
            BUILD_OPTIONS
        );
        scope.collectDocument(kerml);
        expect(scope.getDynamicExports().count()).toEqual(0);
        expect(scope.getExportedElement("B")).toBeUndefined();
    });

    it("should not add dynamic exports if unnamed features are not public", async () => {
        const kerml = await parseKerML(
            "package A { feature a; } protected feature :>> A::a;",
            BUILD_OPTIONS
        );
        scope.collectDocument(kerml);
        expect(scope.getDynamicExports().count()).toEqual(0);
        expect(scope.getExportedElement("a")).toBeUndefined();
    });

    it("should stream all public elements in the global scope", async () => {
        const kerml1 = await parseKerML(BadKerML_import, BUILD_OPTIONS);
        const kerml2 = await parseKerML(SaneKerML, BUILD_OPTIONS);

        scope.collectDocument(kerml1);
        scope.collectDocument(kerml2);

        expect(
            scope
                .getAllExportedElements()
                .map((e) => [e[0], e[1].element()?.qualifiedName])
                .toArray()
        ).toEqual([
            ["A", "A"],
            ["K1", "K1"],
            ["k1", "K1"],
            // dynamic imports are returned last
            ["B", "A::B"],
        ]);
    });

    it("should stream all public elements in the global scope with shadows resolved by lang id", async () => {
        const kerml = await parseKerML(BadKerML_import, BUILD_OPTIONS);
        const sysml = await parseSysML(BadSysML_import, BUILD_OPTIONS);

        scope.collectDocument(kerml);
        scope.collectDocument(sysml);

        expect(
            scope
                .getAllExportedElements(".sysml")
                .map((e) => [e[0], getDocument(e[1].ast() ?? kerml.parseResult.value).uriString])
                .toArray()
        ).toEqual([
            ["A", sysml.uriString],
            ["B", kerml.uriString],
        ]);
    });

    it("should remove invalidated document exports from the scope", async () => {
        const kerml1 = await parseKerML(BadKerML_import, BUILD_OPTIONS);
        const kerml2 = await parseKerML(SaneKerML, BUILD_OPTIONS);

        scope.collectDocument(kerml1);
        scope.collectDocument(kerml2);

        scope.invalidateDocuments([kerml1.uri]);

        expect(
            scope
                .getAllExportedElements()
                .map((e) => [e[0], e[1].element()?.qualifiedName])
                .toArray()
        ).toEqual([
            ["K1", "K1"],
            ["k1", "K1"],
        ]);

        expect(scope.getExportedElement("A")).toBeUndefined();
        expect(scope.getExportedElement("B")).toBeUndefined();
    });
});
