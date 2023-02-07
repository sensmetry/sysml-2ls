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

import { FormattingOptions, TextDocumentIdentifier } from "vscode-languageserver";
import { SysMLFormatter } from "../formatter";
import { TextDocument, TextEdit } from "vscode-languageserver-textdocument";
import type { LangiumDocument, AstNode } from "langium";
import { parseSysML } from "../../../../testing";

const unformattedSysMLExample = `
/* Camera Example from SysML-v2-Release/sysml/src/examples folder */
part def Camera {import PictureTaking::*;perform action takePicture[*] :> PictureTaking::takePicture;
part focusingSubsystem {perform takePicture.focus;}
part imagingSubsystem {perform takePicture.shoot;}
}
`;

interface FormatOriginalDocumentReturnType {
    $document: LangiumDocument<AstNode>;
    formatChanges: TextEdit[];
}

const formatOriginalDocument = async (
    text: string,
    options: FormattingOptions
): Promise<FormatOriginalDocumentReturnType> => {
    const formatter = new SysMLFormatter();
    const documentToFormat = await parseSysML(text);

    expect(documentToFormat.value.$document).toBeDefined();

    const $document = documentToFormat.value.$document;

    if (!$document) throw new Error("Check line above. Document should be defined.");

    const formatChanges = await formatter.formatDocument($document, {
        options,
        textDocument: TextDocumentIdentifier.create($document.uri.toString()),
    });

    return { $document, formatChanges };
};

const DefaultFormattingOptions: FormattingOptions = {
    tabSize: 4,
    insertSpaces: true,
};

async function testFormatting(
    text: string,
    expected: string | undefined,
    options: FormattingOptions = DefaultFormattingOptions
): Promise<void> {
    const { $document, formatChanges } = await formatOriginalDocument(text, options);

    if (expected) {
        expect($document.parseResult.parserErrors).toHaveLength(0);
        expect($document.parseResult.lexerErrors).toHaveLength(0);
        const formatted = TextDocument.applyEdits($document.textDocument, formatChanges);
        expect(formatted).toEqual(expected.trimStart());
    } else {
        expect(formatChanges).toEqual([]);
    }
}

describe("SysMLFormatter", () => {
    it("should format whole document correctly with 4 tabsize, with spaces", async () => {
        await testFormatting(
            unformattedSysMLExample,
            `
/* Camera Example from SysML-v2-Release/sysml/src/examples folder */
part def Camera {
    import PictureTaking::*;
    perform action takePicture [*] :> PictureTaking::takePicture;
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

    it("should format whole document correctly with 2 tabsize, with spaces", async () => {
        await testFormatting(
            unformattedSysMLExample,
            `
/* Camera Example from SysML-v2-Release/sysml/src/examples folder */
part def Camera {
  import PictureTaking::*;
  perform action takePicture [*] :> PictureTaking::takePicture;
  part focusingSubsystem {
    perform takePicture.focus;
  }
  part imagingSubsystem {
    perform takePicture.shoot;
  }
}
`,
            {
                tabSize: 2,
                insertSpaces: true,
            }
        );
    });

    it("should format whole document correctly with 2 tabsize, with tabs", async () => {
        await testFormatting(
            unformattedSysMLExample,
            `
/* Camera Example from SysML-v2-Release/sysml/src/examples folder */
part def Camera {
	import PictureTaking::*;
	perform action takePicture [*] :> PictureTaking::takePicture;
	part focusingSubsystem {
		perform takePicture.focus;
	}
	part imagingSubsystem {
		perform takePicture.shoot;
	}
}
`,
            {
                tabSize: 2,
                insertSpaces: false,
            }
        );
    });

    it("should remove any extraneous empty lines to the first child element", async () => {
        await testFormatting(
            `part def A{
            
            

    

    part a: A;
}`,
            `
part def A {
    part a: A;
}`
        );
    });

    it("should leave a single empty line between children element", async () => {
        await testFormatting(
            `part def A{
    part a: A;





    part b: A;
}`,
            `
part def A {
    part a: A;

    part b: A;
}`
        );
    });

    it("should a new line to the first child element", async () => {
        await testFormatting(
            "part def A{part a: A;}",
            `
part def A {
    part a: A;
}`
        );
    });

    it("should remove extraneous lines to single line comments when the comment is the first child element", async () => {
        await testFormatting(
            `part A{
            
            
            
            // comment
        }`,
            `
part A {
    // comment
}`
        );
    });

    it("should remove extraneous lines to multiline comments when the comment is the first child element", async () => {
        await testFormatting(
            `part A{
            
            
            
            //* comment
            */
        }`,
            `
part A {
    //* comment
    */
}`
        );
    });

    it("should remove extraneous lines to single line comments when the comment is not the first child element", async () => {
        await testFormatting(
            `part A{part a: A;
            
            
            
            // comment
        }`,
            `
part A {
    part a: A;

    // comment
}`
        );
    });

    it("should remove extraneous lines to multiline comments when the comment is not the first child element", async () => {
        await testFormatting(
            `part A{part a: A;
            
            
            
            //* comment
            */
        }`,
            `
part A {
    part a: A;

    //* comment
    */
}`
        );
    });

    it("should remove any whitespace to the root comment if it's the first element", async () => {
        await testFormatting(
            `
        
        
        // comment
`,
            "// comment\n"
        );
    });

    it("should remove any whitespace in-between braces if there are no children", async () => {
        await testFormatting(
            `part P {     

        }`,
            "part P {}"
        );
    });

    it("should remove any whitespace to metadata declarators", async () => {
        await testFormatting(
            `#     Meta part P {
            @
            
            Meta;
        }`,
            `#Meta part P {
    @Meta;
}`
        );
    });

    it("should format multiple elements in the root namespace", async () => {
        await testFormatting(
            `

        // comment
        part def A;
        
        
        
        part def B;part def C;`,
            `
// comment
part def A;

part def B;
part def C;`
        );
    });

    it("should not format documents with parser errors", async () => {
        await testFormatting(
            `
        
        
        part a`,
            undefined
        );
    });

    it("should respect and indent AST continuations intersected by comments", async () => {
        await testFormatting(
            `
        #   // a comment



        Meta part P {
        }`,
            `
# // a comment
    Meta part P {}`
        );
    });

    it("should respect and indent AST continuations intersected by comments and indented by tabs", async () => {
        await testFormatting(
            `
        #   // a comment



        Meta part P {
        }`,
            `
# // a comment
\tMeta part P {}`,
            { ...DefaultFormattingOptions, insertSpaces: false }
        );
    });

    it("should leave a single leading space to end of line comment", async () => {
        await testFormatting("part P {}     // comment", "part P {} // comment");
    });

    it("should leave a single leading space to end of line multiline comment", async () => {
        await testFormatting("part P {}     //* comment */", "part P {} //* comment */");
    });

    it("should format comments inside a reference", async () => {
        await testFormatting(
            "part P: A::       //* comment */   B {}",
            "part P: A:: //* comment */ B {}"
        );
    });

    it("should format comments inside a multiline reference", async () => {
        await testFormatting(
            `
        part P: A::       // comment
        
            B {}`,
            `
part P: A:: // comment
    B {}`
        );
    });
});
