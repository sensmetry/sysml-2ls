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

import { LangiumDocument } from "langium";
import { DefaultPrinterConfig, group, print, printDoc } from "../../../utils";
import { NamespaceMeta } from "../../KerML";
import { ElementIDProvider, basicIdProvider } from "../../metamodel";
import {
    KerMLKeywords,
    SysMLKeywords,
    printAstReference,
    printIdentifier,
    printIdentifiers,
    throwError,
} from "../utils";
import { emptyDocument, parsedNode } from "../../../testing";
import { ElementReference, Package } from "../../../generated/ast";
import { defaultKerMLPrinterContext } from "../print";

let provider: ElementIDProvider;
let document: LangiumDocument;

beforeAll(() => {
    provider = basicIdProvider();
    document = emptyDocument("printer_utils", ".sysml");
});

describe("identifiers", () => {
    it("should surround restricted names with quotes", () => {
        expect(print(printIdentifier("part", { restricted: new Set(["part"]) }))).toEqual(
            "'part'\n"
        );
    });

    it("should print fitting names on a single line", () => {
        expect(
            print(
                group(
                    printIdentifiers(
                        NamespaceMeta.create(provider, document, {
                            declaredName: "name",
                            declaredShortName: "short",
                        })
                    )
                )
            )
        ).toEqual("<short> name\n");
    });

    it("should break long short names", () => {
        expect(
            print(
                group(
                    printIdentifiers(
                        NamespaceMeta.create(provider, document, {
                            declaredName: "name",
                            declaredShortName: "some very short name",
                        })
                    )
                ),
                { lineWidth: 10 }
            )
        ).toEqual("<\n    'some very short name'\n> name\n");
    });

    it("should print semantic token types and modifiers", () => {
        expect(
            printDoc(
                group(
                    printIdentifiers(
                        NamespaceMeta.create(provider, document, {
                            declaredName: "name",
                            declaredShortName: "short",
                        }),
                        defaultKerMLPrinterContext({ highlighting: true })
                    )
                ),

                { ...DefaultPrinterConfig, highlighting: true }
            ).highlighting
        ).toMatchObject([
            {
                modifiers: ["declaration"],
                type: "namespace",
            },
            {
                modifiers: ["declaration"],
                type: "namespace",
            },
        ]);
    });
});

describe("references", () => {
    it("should break long reference chains", () => {
        expect(
            print(
                printAstReference(
                    {
                        $childIndex: 0,
                        $children: [],
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        $container: {} as any,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        $meta: { notes: [], nodeType: () => ElementReference } as any,
                        $type: ElementReference,
                        parts: [
                            { $refText: "'first element'" },
                            { $refText: "'second element'" },
                            { $refText: "'third element'" },
                            { $refText: "'fourth element'" },
                            { $refText: "'fifth element'" },
                        ],
                    },
                    { ...defaultKerMLPrinterContext(), highlighting: false }
                ),
                { lineWidth: 60 }
            )
        ).toMatchInlineSnapshot(`
"'first element'::'second element'::'third element'
    ::'fourth element'::'fifth element'
"
`);
    });
});

describe("keywords", () => {
    it("should have KerML keywords collected", () => {
        expect(KerMLKeywords()).toMatchSnapshot();
    });

    it("should have SysML keywords collected", () => {
        expect(SysMLKeywords()).toMatchSnapshot();
    });
});

describe("other", () => {
    test("throwError should add source location", async () => {
        const node = await parsedNode("package P {}", { lang: "kerml", node: Package });
        expect(() => throwError(node.$meta, "test")).toThrowErrorMatchingInlineSnapshot(
            `"test on line 1, character: 1"`
        );
    });
});
