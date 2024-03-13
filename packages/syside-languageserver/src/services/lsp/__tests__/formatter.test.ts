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

import { FormattingOptions, Range, TextDocumentIdentifier } from "vscode-languageserver";
import { SysMLFormatter } from "../formatter";
import { TextDocument, TextEdit } from "vscode-languageserver-textdocument";
import type { LangiumDocument, DeepPartial } from "langium";
import { getRange, parseKerML, parseSysML, services } from "../../../testing";
import { PrintRange } from "../../../model";

const unformattedSysMLExample = `
part def Camera {import PictureTaking::*;perform action takePicture[*] :> PictureTaking::takePicture;
part focusingSubsystem {perform takePicture.focus;}
part imagingSubsystem {perform takePicture.shoot;}
}
`;

interface TestFormattingOptions extends FormattingOptions {
    langId?: "kerml" | "sysml";
}

const formatter = services.SysML.lsp.Formatter as SysMLFormatter;

async function getDocument(
    text: string,
    options: Pick<TestFormattingOptions, "langId"> = {}
): Promise<LangiumDocument> {
    const documentToFormat = await (options.langId === "kerml" ? parseKerML : parseSysML)(text, {
        validationChecks: "none",
    });

    expect(documentToFormat.value.$document).toBeDefined();

    const $document = documentToFormat.value.$document;

    if (!$document) throw new Error("Check line above. Document should be defined.");
    return $document;
}

function checkFormatted({
    document,
    edits,
}: {
    document: LangiumDocument;
    edits: TextEdit[];
}): string {
    expect(document.parseResult.parserErrors).toHaveLength(0);
    expect(document.parseResult.lexerErrors).toHaveLength(0);
    return TextDocument.applyEdits(document.textDocument, edits);
}

async function formatDocument(
    document: LangiumDocument,
    options: Partial<FormattingOptions> = {}
): Promise<TextEdit[]> {
    return formatter.formatDocument(document, {
        options: { ...DefaultFormattingOptions, ...options },
        textDocument: TextDocumentIdentifier.create(document.uriString),
    });
}

const DefaultFormattingOptions: FormattingOptions = {
    tabSize: 4,
    insertSpaces: true,
};

function expectFormatted(
    text: string,
    options: DeepPartial<TestFormattingOptions> = DefaultFormattingOptions
): jest.JestMatchers<Promise<string>> {
    return expect(
        getDocument(text, options)
            .then(async (document) => ({
                document,
                edits: await formatDocument(document, options),
            }))
            .then(checkFormatted)
    );
}

async function formatDocumentRange(
    document: LangiumDocument,
    range: PrintRange,
    options: Partial<FormattingOptions> = {}
): Promise<TextEdit[]> {
    return formatter.formatDocumentRange(document, {
        range: Range.create(
            document.textDocument.positionAt(range.offset),
            document.textDocument.positionAt(range.end)
        ),
        options: { ...DefaultFormattingOptions, ...options },
        textDocument: TextDocumentIdentifier.create(document.uriString),
    });
}

function expectFormattedRange(
    source: string,
    options: DeepPartial<TestFormattingOptions> = DefaultFormattingOptions
): jest.JestMatchers<Promise<string>> {
    const { text, range } = getRange(source);
    return expect(
        getDocument(text, options)
            .then(async (document) => ({
                document,
                edits: await formatDocumentRange(document, range, options),
            }))
            .then(checkFormatted)
    );
}

async function formatDocumentOnType(
    document: LangiumDocument,
    range: PrintRange,
    options: Partial<FormattingOptions> = {}
): Promise<TextEdit[]> {
    return formatter.formatDocumentOnType(document, {
        position: document.textDocument.positionAt(range.offset),
        ch: "",
        options: { ...DefaultFormattingOptions, ...options },
        textDocument: TextDocumentIdentifier.create(document.uriString),
    });
}

function expectFormattedOnType(
    source: string,
    options: DeepPartial<TestFormattingOptions> = DefaultFormattingOptions
): jest.JestMatchers<Promise<string>> {
    const { text, range } = getRange(source);
    return expect(
        getDocument(text, options)
            .then(async (document) => ({
                document,
                edits: await formatDocumentOnType(document, range, options),
            }))
            .then(checkFormatted)
    );
}

describe("SysMLFormatter", () => {
    describe("document formatting", () => {
        it("should format whole document correctly with 4 tabsize, with spaces", () => {
            return expectFormatted(unformattedSysMLExample).resolves.toEqual(
                `part def Camera {
    import PictureTaking::*;
    perform action takePicture :> PictureTaking::takePicture [*];
    part focusingSubsystem {
        perform takePicture.focus;
    }
    part imagingSubsystem {
        perform takePicture.shoot;
    }
}
`
            );
        });

        it("should format whole document correctly with 2 tabsize, with spaces", () => {
            return expectFormatted(unformattedSysMLExample, {
                tabSize: 2,
                insertSpaces: true,
            }).resolves.toEqual(
                `part def Camera {
  import PictureTaking::*;
  perform action takePicture :> PictureTaking::takePicture [*];
  part focusingSubsystem {
    perform takePicture.focus;
  }
  part imagingSubsystem {
    perform takePicture.shoot;
  }
}
`
            );
        });

        it("should format whole document correctly with 2 tabsize, with tabs", () => {
            return expectFormatted(unformattedSysMLExample, {
                tabSize: 2,
                insertSpaces: false,
            }).resolves.toEqual(
                `part def Camera {
	import PictureTaking::*;
	perform action takePicture :> PictureTaking::takePicture [*];
	part focusingSubsystem {
		perform takePicture.focus;
	}
	part imagingSubsystem {
		perform takePicture.shoot;
	}
}
`
            );
        });

        it("should format multiple elements in the root namespace", () => {
            return expectFormatted(
                `
    
            // comment
            part def A;
            
            
            
            part def B;part def C;`
            ).resolves.toEqual(
                `// comment
part def A;

part def B;
part def C;`
            );
        });

        it("should not format documents with parser errors", () => {
            return expect(
                getDocument("part a").then((doc) => formatDocument(doc))
            ).resolves.toHaveLength(0);
        });

        it("should indent package children in KerML", () => {
            return expectFormatted(
                `
        library package Pack {
            abstract class <klass> Klass;
            alias KK for Klass;
            
            comment Comment /* comment */
            
            namespace Type {
            doc /* doc */
            }
            }`,
                { langId: "kerml" }
            ).resolves.toEqual(
                `library package Pack {
    abstract class <klass> Klass;
    alias KK for Klass;

    comment Comment
    /*
     * comment
     */

    namespace Type {
        doc
        /*
         * doc
         */
    }
}`
            );
        });

        it("should remove any extraneous empty lines to the first child element", () => {
            return expectFormatted(
                `part def A{
            
            

    

    part a: A;
}`
            ).resolves.toEqual(
                `part def A {
    part a : A;
}`
            );
        });

        it("should leave a single empty line between children element", () => {
            return expectFormatted(
                `part def A{
    part a: A;





    part b: A;
}`
            ).resolves.toEqual(
                `part def A {
    part a : A;

    part b : A;
}`
            );
        });

        it("should a new line to the first child element", () => {
            return expectFormatted("part def A{part a: A;}").resolves.toEqual(
                `part def A {
    part a : A;
}`
            );
        });

        it("should remove any whitespace in-between braces if there are no children", () => {
            return expectFormatted(
                `part P {     
    
            }`
            ).resolves.toEqual("part P {}");
        });
    });

    describe("range formatting", () => {
        it("should format document range overlapping multiple children correctly", () => {
            return expectFormattedRange(`part def Camera {
    import PictureTaking::*;
    perform action takePicture [*] :>

        PictureTaking::takePicture;
    part |focusingSubsystem { perform takePicture.focus; }
    part imagingSubsystem { perform takePicture.shoot; |}
}`).resolves.toEqual(
                `part def Camera {
    import PictureTaking::*;
    perform action takePicture [*] :>

        PictureTaking::takePicture;
    part focusingSubsystem {
        perform takePicture.focus;
    }
    part imagingSubsystem {
        perform takePicture.shoot;
    }
}`
            );
        });

        it("should format document range overlapping a single child correctly", () => {
            return expectFormattedRange(`part def Camera {
    import PictureTaking::*;
    perform action takePicture [*] :>

        PictureTaking::takePicture;
    part focusingSubsystem { perform takePicture.focus; }
    part imagin|gSubsystem { perform takePicture.shoot; |}
}`).resolves.toEqual(
                `part def Camera {
    import PictureTaking::*;
    perform action takePicture [*] :>

        PictureTaking::takePicture;
    part focusingSubsystem { perform takePicture.focus; }
    part imagingSubsystem {
        perform takePicture.shoot;
    }
}`
            );
        });

        it("should not format document with errors", () => {
            return expect(
                getDocument("part").then((doc) =>
                    formatDocumentRange(doc, { offset: 0, end: 0 }, {})
                )
            ).resolves.toHaveLength(0);
        });
    });

    describe("on type formatting", () => {
        it("should format document range overlapping multiple children correctly", () => {
            return expectFormattedOnType(`part def Camera {
    import PictureTaking::*;
    perform action takePicture [*] :>

        PictureTaking::takePicture;
    part focusingSubsystem ||{ perform takePicture.focus; }
    part imagingSubsystem { perform takePicture.shoot; }
}`).resolves.toEqual(
                `part def Camera {
    import PictureTaking::*;
    perform action takePicture [*] :>

        PictureTaking::takePicture;
    part focusingSubsystem {
        perform takePicture.focus;
    }
    part imagingSubsystem { perform takePicture.shoot; }
}`
            );
        });

        it("should not format document with errors", () => {
            return expect(
                getDocument("part").then((doc) =>
                    formatDocumentRange(doc, { offset: 0, end: 0 }, {})
                )
            ).resolves.toHaveLength(0);
        });
    });
});
