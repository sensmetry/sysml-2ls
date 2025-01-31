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

import { DeepPartial } from "langium";
import {
    Class,
    ClassifierReference,
    FeatureValue,
    NullExpression,
    OwningMembership,
    Subsetting,
} from "../../../generated/ast";
import { SysMLType } from "../../../services";
import { parseKerML, parseSysML, recursiveObjectContaining } from "../../../testing";
import { TextComment } from "../../../utils";
import { attachNotes } from "../attach";

async function expectNotes(
    text: string,
    options: {
        lang?: "sysml" | "kerml";
        node: SysMLType;
        index?: number;
    }
): Promise<jest.JestMatchers<TextComment[] | undefined>> {
    const lang = options.lang ?? "kerml";
    const doc = await (lang === "kerml" ? parseKerML : parseSysML)(text, {
        document: true,
        build: false,
    });
    attachNotes(doc);

    expect(doc.commentsAttached).toBeTruthy();
    let current = -1;
    const index = options.index ?? 0;
    return expect(
        doc.astNodes.find((node) => node.$type === options.node && ++current === index)?.$meta
            ?.notes
    );
}

type TextCommentMatch = DeepPartial<Required<TextComment>>;

describe("notes", () => {
    it("should attach inner ML note", async () => {
        (await expectNotes("feature a = ( //* a note */ );", { node: NullExpression })).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "block",
                text: " a note ",
                localPlacement: "inner",
                placement: "remaining",
            }),
        ]);
    });

    it("should attach inner SL note", async () => {
        (await expectNotes("feature a = ( // a note\n);", { node: NullExpression })).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "line",
                text: " a note",
                localPlacement: "inner",
                placement: "endOfLine",
            }),
        ]);
    });

    it("should attach trailing note", async () => {
        (await expectNotes("feature a = () //* a note */;", { node: FeatureValue })).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "block",
                text: " a note ",
                localPlacement: "trailing",
                placement: "remaining",
            }),
        ]);
    });

    it("should attach EOL trailing note", async () => {
        (await expectNotes("feature a = (); //* a note */", { node: OwningMembership })).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "block",
                text: " a note ",
                localPlacement: "trailing",
                placement: "endOfLine",
            }),
        ]);
    });

    it("should attach EOL leading note", async () => {
        (await expectNotes("feature a = //* a note */\n();\n", { node: NullExpression })).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "block",
                text: " a note ",
                localPlacement: "leading",
                placement: "endOfLine",
            }),
        ]);
    });

    it("should attach own line trailing note", async () => {
        (await expectNotes("feature a = ();\n//* a note */", { node: OwningMembership })).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "block",
                text: " a note ",
                localPlacement: "trailing",
                placement: "ownLine",
            }),
        ]);
    });

    it("should attach own line leading note", async () => {
        (await expectNotes("feature a = \n//* a note */\n();\n", { node: NullExpression })).toEqual(
            [
                recursiveObjectContaining<TextCommentMatch>({
                    kind: "block",
                    text: " a note ",
                    localPlacement: "leading",
                    placement: "ownLine",
                }),
            ]
        );
    });

    it("should attach own line inner note", async () => {
        (await expectNotes("feature a = (\n//* a note */\n);\n", { node: NullExpression })).toEqual(
            [
                recursiveObjectContaining<TextCommentMatch>({
                    kind: "block",
                    text: " a note ",
                    localPlacement: "inner",
                    placement: "ownLine",
                }),
            ]
        );
    });

    it("should attach remaining leading note 1", async () => {
        (await expectNotes("feature a = //* a note */();\n", { node: NullExpression })).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "block",
                text: " a note ",
                localPlacement: "leading",
                placement: "remaining",
            }),
        ]);
    });

    it("should attach remaining leading note 2", async () => {
        (
            await expectNotes("class a { class b; //* a note */ classifier c; }", {
                node: OwningMembership,
                index: 2,
            })
        ).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "block",
                text: " a note ",
                localPlacement: "leading",
                placement: "remaining",
            }),
        ]);
    });

    it("should attach remaining trailing note", async () => {
        (
            await expectNotes("class a { feature b :> c //* a note */ :>> d; }", {
                node: Subsetting,
            })
        ).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "block",
                text: " a note ",
                localPlacement: "trailing",
                placement: "remaining",
            }),
        ]);
    });

    it("should attach end of line notes inside bodies to the enclosing node", async () => {
        (
            await expectNotes("#prefix class a { // note \n }", {
                node: Class,
            })
        ).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "line",
                text: " note ",
                localPlacement: "inner",
                placement: "endOfLine",
            }),
        ]);
    });

    it("should attach own line notes inside bodies to the enclosing node", async () => {
        (
            await expectNotes("#prefix class a { \n// note \n }", {
                node: Class,
            })
        ).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "line",
                text: " note ",
                localPlacement: "inner",
                placement: "ownLine",
            }),
        ]);
    });

    it("should attach remaining notes inside bodies to the enclosing node", async () => {
        (
            await expectNotes("#prefix class a { //* note */ }", {
                node: Class,
            })
        ).toEqual([
            recursiveObjectContaining<TextCommentMatch>({
                kind: "block",
                text: " note ",
                localPlacement: "inner",
                placement: "remaining",
            }),
        ]);
    });

    describe("inner reference notes", () => {
        it("should attach remaining note with a label", async () => {
            (
                await expectNotes("class a :> b:: //* note */ c; }", {
                    node: ClassifierReference,
                })
            ).toEqual([
                recursiveObjectContaining<TextCommentMatch>({
                    kind: "block",
                    text: " note ",
                    localPlacement: "inner",
                    placement: "remaining",
                    label: "1-leading",
                }),
            ]);
        });

        it("should attach end of line note with a label", async () => {
            (
                await expectNotes("class a :> b:: //* note */ \nc; }", {
                    node: ClassifierReference,
                })
            ).toEqual([
                recursiveObjectContaining<TextCommentMatch>({
                    kind: "block",
                    text: " note ",
                    localPlacement: "inner",
                    placement: "endOfLine",
                    label: "0-trailing",
                }),
            ]);
        });
    });
});
