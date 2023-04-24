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

import { MarkupContent, Position, TextDocumentIdentifier } from "vscode-languageserver";
import { parseSysML, services } from "../../../testing";

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

type StringMatch =
    | string
    | RegExp
    | ReturnType<jest.Expect["stringContaining"]>
    | ReturnType<jest.Expect["stringMatching"]>;

const testHover = async (
    position: Position,
    expected: StringMatch | StringMatch[] | undefined,
    raw: string = sysMLExampleRaw
): Promise<void> => {
    const hoverProvider = services.SysML.lsp.HoverProvider;

    const {
        value: { $document },
    } = await parseSysML(raw);

    if (!$document) throw new Error("Document should be present");

    const hoverResult = await hoverProvider?.getHoverContent($document, {
        position,
        textDocument: TextDocumentIdentifier.create($document.uri.toString()),
    });

    if (!expected) {
        expect(hoverResult).toBeUndefined();
    } else {
        expect(hoverResult).toBeDefined();
        const contents = hoverResult?.contents as MarkupContent;
        expect(contents.kind).toEqual("markdown");

        const test = (value: StringMatch): void => {
            if (value instanceof RegExp || typeof value === "string") {
                expect(contents.value).toMatch(value);
            } else {
                // expect.stringContaining
                expect(contents.value).toEqual(value);
            }
        };

        if (!Array.isArray(expected)) test(expected);
        else expected.forEach((value) => test(value));
    }
};

describe("SysMLHoverProvider", () => {
    it("should provide hover info for Camera", async () => {
        await testHover(
            {
                line: 0,
                character: 12, // Camera
            },
            /#### `Camera`\n`PartDefinition` in ` [a-zA-Z0-9]+\.sysml` {2}\n/
        );
    });

    it("should not provide result", async () => {
        await testHover(
            {
                line: 1,
                character: 5, // import
            },
            undefined
        );
    });

    it("should provide hover", async () => {
        await testHover(
            {
                line: 3,
                character: 24, // takePicture[*]
            },
            /#### `Camera::takePicture`\n`PerformActionUsage` in ` [a-zA-Z0-9]+\.sysml` {2}\n/
        );
    });

    it("should combine doc comments for repeating properties into one", async () => {
        await testHover(
            {
                line: 0,
                character: 12,
            },
            /#### `Camera`\n`PartDefinition` in ` [a-zA-Z0-9]+\.sysml` {2}\n\ndoc about Camera\n\nanother doc/,
            `part def Camera {
                doc /* doc about Camera */
                doc /* another doc */
            }`
        );
    });

    // TODO: Feel free to add more tests like the above. Just need to provide the position where you want to hover and test that result is what you expect.

    it("should add additional text from successful hover events", async () => {
        const extra = "additional hover text";
        const disposable = services.SysML.Events.onHoverRequest.add(() => extra);

        await testHover(
            {
                line: 0,
                character: 12, // Camera
            },
            expect.stringContaining(extra)
        ).finally(() => disposable.dispose());
    });

    it("should not add additional text from throwing callbacks", async () => {
        const extra = "additional hover text";
        const disposable = services.SysML.Events.onHoverRequest.add(() => {
            throw extra;
        });

        const error = console.error;
        const errorMock = jest.fn();
        console.error = errorMock;
        await testHover(
            {
                line: 0,
                character: 12, // Camera
            },
            []
        ).finally(() => {
            console.error = error;
            disposable.dispose();
        });

        expect(errorMock).toHaveBeenCalledTimes(1);
        expect(errorMock).toHaveBeenCalledWith(expect.stringContaining(extra));
    });
});
