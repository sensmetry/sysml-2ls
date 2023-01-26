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

import { SysMLHoverProvider } from "../hover-provider";

import { Hover, MarkupContent, Position, TextDocumentIdentifier } from "vscode-languageserver";
import { parseSysML, services } from "../../../../testing";

const sysMLExampleRaw = `part def Camera {
	import PictureTaking::*;

	perform action takePicture[*] :> PictureTaking::takePicture;

	part focusingSubsystem {
		perform takePicture.focus;
	}

	part imagingSubsystem {
		perform takePicture.shoot;
	}
}`;

const getHoverAtPosition = async (
    position: Position,
    raw: string = sysMLExampleRaw
): Promise<Hover | undefined> => {
    const hoverProvider = new SysMLHoverProvider(services.SysML);

    const {
        value: { $document },
    } = await parseSysML(raw);

    if (!$document) throw new Error("Document should be present");

    const hoverResult = await hoverProvider.getHoverContent($document, {
        position,
        textDocument: TextDocumentIdentifier.create($document.uri.toString()),
    });

    return hoverResult;
};

describe("SysMLHoverProvider", () => {
    it("should provide hover info for Camera", async () => {
        const hoverResult = await getHoverAtPosition({
            line: 0,
            character: 12, // Camera
        });

        if (!hoverResult) throw new Error("Hover result should be defined");

        const contents = hoverResult.contents as MarkupContent;

        expect(contents.kind).toEqual("markdown");
        expect(contents.value).toMatch(
            /#### `Camera`\n`PartDefinition` in ` [a-zA-Z0-9]+\.sysml` {2}\n/
        );
    });

    it("should not provide result", async () => {
        const hoverResult = await getHoverAtPosition({
            line: 1,
            character: 5, // import
        });

        expect(hoverResult).toBeUndefined();
    });

    it("should provide hover", async () => {
        const hoverResult = await getHoverAtPosition({
            line: 3,
            character: 24, // takePicture[*]
        });

        if (!hoverResult) throw new Error("Hover result should be defined");

        const contents = hoverResult.contents as MarkupContent;

        expect(contents.kind).toEqual("markdown");
        expect(contents.value).toMatch(
            /#### `Camera::takePicture`\n`PerformActionUsage` in ` [a-zA-Z0-9]+\.sysml` {2}\n/
        );
    });

    it("should combine doc comments for repeating properties into one", async () => {
        const hoverResult = await getHoverAtPosition(
            {
                line: 0,
                character: 12,
            },
            `part def Camera {
                doc /* doc about Camera */
                doc /* another doc */
            }`
        );

        if (!hoverResult) throw new Error("Hover result should be defined");
        const contents = hoverResult.contents as MarkupContent;

        expect(contents.kind).toEqual("markdown");
        expect(contents.value).toMatch(
            /#### `Camera`\n`PartDefinition` in ` [a-zA-Z0-9]+\.sysml` {2}\n\ndoc about Camera\n\nanother doc/
        );
    });

    // TODO: Feel free to add more tests like the above. Just need to provide the position where you want to hover and test that result is what you expect.
});
