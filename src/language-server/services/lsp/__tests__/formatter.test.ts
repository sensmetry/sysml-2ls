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
part def Camera {import PictureTaking::*;
perform action takePicture[*] :> PictureTaking::takePicture
part focusingSubsystem {perform takePicture.focus;}
part imagingSubsystem {perform takePicture.shoot;}
}
`;

interface FormatOriginalDocumentReturnType {
    $document: LangiumDocument<AstNode>;
    formatChanges: TextEdit[];
}

const formatOriginalDocument = async (
    options: FormattingOptions
): Promise<FormatOriginalDocumentReturnType> => {
    const formatter = new SysMLFormatter();
    const documentToFormat = await parseSysML(unformattedSysMLExample);

    expect(documentToFormat.value.$document).toBeDefined();

    const $document = documentToFormat.value.$document;

    if (!$document) throw new Error("Check line above. Document should be defined.");

    const formatChanges = await formatter.formatDocument($document, {
        options,
        textDocument: TextDocumentIdentifier.create($document.uri.toString()),
    });

    return { $document, formatChanges };
};

describe("SysMLFormatter", () => {
    it("should format whole document correctly with 4 tabsize, with spaces", async () => {
        const { $document, formatChanges } = await formatOriginalDocument({
            tabSize: 4,
            insertSpaces: true,
        });

        expect(TextDocument.applyEdits($document.textDocument, formatChanges))
            .toMatchInlineSnapshot(`
"/* Camera Example from SysML-v2-Release/sysml/src/examples folder */
part def Camera {
    
    import PictureTaking::*;
    perform action takePicture [*] :> PictureTaking::takePicture
    part focusingSubsystem {
        perform takePicture.focus;
    }
    part imagingSubsystem {
        perform takePicture.shoot;
    }
}
"
`);
    });

    it("should format whole document correctly with 2 tabsize, with spaces", async () => {
        const { $document, formatChanges } = await formatOriginalDocument({
            tabSize: 2,
            insertSpaces: true,
        });

        expect(TextDocument.applyEdits($document.textDocument, formatChanges))
            .toMatchInlineSnapshot(`
"/* Camera Example from SysML-v2-Release/sysml/src/examples folder */
part def Camera {
  
  import PictureTaking::*;
  perform action takePicture [*] :> PictureTaking::takePicture
  part focusingSubsystem {
    perform takePicture.focus;
  }
  part imagingSubsystem {
    perform takePicture.shoot;
  }
}
"
`);
    });

    it("should format whole document correctly with 2 tabsize, with tabs", async () => {
        const { $document, formatChanges } = await formatOriginalDocument({
            tabSize: 2,
            insertSpaces: false,
        });

        expect(TextDocument.applyEdits($document.textDocument, formatChanges))
            .toMatchInlineSnapshot(`
"/* Camera Example from SysML-v2-Release/sysml/src/examples folder */
part def Camera {
	
	import PictureTaking::*;
	perform action takePicture [*] :> PictureTaking::takePicture
	part focusingSubsystem {
		perform takePicture.focus;
	}
	part imagingSubsystem {
		perform takePicture.shoot;
	}
}
"
`);
    });
});
