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

import { URI } from "vscode-uri";
import { TEST_BUILD_OPTIONS, generateString } from "../../../../testing";
import { LangiumDocument } from "langium";
import { createSysMLServices } from "../../../sysml-module";
import {
    CompletionParams,
    TextDocumentIdentifier,
    Position,
    CompletionTriggerKind,
} from "vscode-languageserver";
import { Namespace } from "../../../generated/ast";
import { SysMLServices, KerMLServices, SysMLSharedServices } from "../../services";
import { SysMLNodeFileSystem } from "../../../node/node-file-system-provider";

const test_table = [
    {
        text: `pack
`,
        line: 0,
        character: 3,
        triggerKind: undefined,
        triggerCharacter: undefined,
        expectedLabel: "package",
        expectedNewText: undefined,
    },

    {
        text: `lib
`,
        line: 0,
        character: 3,
        triggerKind: undefined,
        triggerCharacter: undefined,
        expectedLabel: "library",
        expectedNewText: undefined,
    },

    {
        text: `package 'Test' {

    part def Vehicle {
        part eng : Engine;
    }
    part def Engine;
    part def MyEngine :>
}
`,
        line: 7,
        character: 24,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        triggerCharacter: ">",
        expectedLabel: "Engine",
        expectedNewText: undefined,
    },

    {
        text: `package 'Test' {
    
    enum def TrafficLightColor {
        enum Green;
        enum Yellow;
        enum Red;
    }
    
    currentColor = TrafficLightColor::
}
`,
        line: 8,
        character: 38,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        triggerCharacter: ":",
        expectedLabel: "Green",
        expectedNewText: undefined,
    },

    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinder;
    part def '1myCylinder' :> Cylinder;
    part engine : Engine {
        part cylinder : '';
    }
}
`,
        line: 5,
        character: 25,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        triggerCharacter: "'",
        expectedLabel: "1myCylinder",
        expectedNewText: undefined,
    },

    {
        text: `part def Engine;
part engine : Engine {
    part cyl = Engine.
}
`,
        line: 2,
        character: 22,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        triggerCharacter: ".",
        expectedLabel: "metadata",
        expectedNewText: "metadata",
    },

    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinders
    part def '6Cylinders' :> Cylinders;
    part engine : Engine {
        part cyls :  
    }
}
`,
        line: 5,
        character: 20,
        triggerKind: CompletionTriggerKind.Invoked,
        triggerCharacter: undefined,
        expectedLabel: "6Cylinders",
        expectedNewText: "'6Cylinders'",
    },

    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinders;
    part def '6Cylinders' :> Cylinders;
}
import myPack::'
`,
        line: 5,
        character: 16,
        triggerKind: CompletionTriggerKind.Invoked,
        triggerCharacter: undefined,
        expectedLabel: "6Cylinders",
        expectedNewText: "6Cylinders'",
    },

    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinders;
    part def '6Cylinders' :> Cylinders;
}
import myPack::'
`,
        line: 5,
        character: 15,
        triggerKind: CompletionTriggerKind.Invoked,
        triggerCharacter: undefined,
        expectedLabel: "6Cylinders",
        expectedNewText: "'6Cylinders",
    },

    {
        text: `part a { part b; }
part c : a { :>> }
`,
        line: 1,
        character: 16,
        triggerKind: CompletionTriggerKind.Invoked,
        triggerCharacter: undefined,
        expectedLabel: "b",
        expectedNewText: "b",
    },

    {
        text: `part a { part b; }
part c : a { :>> }
`,
        line: 1,
        character: 16,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        triggerCharacter: ">",
        expectedLabel: "b",
        expectedNewText: "b",
    },
    {
        text: `package 'Vehicle' {
    part def Cylinder;
    part def Engine {
        part cylinder : Cy
    }
}
`,
        line: 3,
        character: 26,
        triggerKind: undefined,
        triggerCharacter: undefined,
        expectedLabel: "Cylinder",
        expectedNewText: undefined,
    },
];

const failing_test_table = [
    // Test case currently fails due to parser limitation
    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinder;
    part def '1MyCylinder' :> Cylinder;
    part engine : Engine {
        part myCylinder : '
    }
}
`,
        line: 5,
        character: 27,
        triggerKind: CompletionTriggerKind.Invoked,
        triggerCharacter: undefined,
        expectedLabel: "1MyCylinder",
        expectedNewText: "1MyCylinder'",
    },
];

const defaultSysMLservices = createSysMLServices(SysMLNodeFileSystem, {
    standardLibrary: false,
    logStatistics: false,
});

// Builds a document, provides completion params.
// Also provides SysML services reference that is separate from the rest of unit tests
async function buildDocumentAndCompletionParams(
    text: string,
    line: number,
    character: number,
    triggerKind?: CompletionTriggerKind,
    triggerCharacter?: string
): Promise<{
    services: {
        shared: SysMLSharedServices;
        SysML: SysMLServices;
        KerML: KerMLServices;
    };
    document: LangiumDocument<Namespace>;
    completionParams: CompletionParams;
}> {
    const uri = URI.file(generateString(16) + ".sysml");
    const completionParams: CompletionParams = {
        textDocument: TextDocumentIdentifier.create(uri.toString()),
        position: Position.create(line, character),
        context: triggerKind ? { triggerKind, triggerCharacter } : undefined,
    };

    const services = defaultSysMLservices;
    const document = services.shared.workspace.LangiumDocumentFactory.fromString<Namespace>(
        text,
        uri
    );
    await services.shared.workspace.DocumentBuilder.build([document], TEST_BUILD_OPTIONS);
    return { services, document, completionParams };
}

async function executeCompletionTestCase({
    text,
    line,
    character,
    triggerKind,
    triggerCharacter,
    expectedLabel,
    expectedNewText,
}): Promise<void> {
    const { services, document, completionParams } = await buildDocumentAndCompletionParams(
        text,
        line,
        character,
        triggerKind,
        triggerCharacter
    );
    const completionList = await services.SysML.lsp.CompletionProvider?.getCompletion(
        document,
        completionParams
    );
    const expectation =
        expectedNewText !== undefined
            ? {
                  label: expectedLabel,
                  textEdit: expect.objectContaining({ newText: expectedNewText }),
              }
            : { label: expectedLabel };

    expect(completionList?.items).toEqual(
        expect.arrayContaining([expect.objectContaining(expectation)])
    );
}

test.concurrent.each(test_table)(
    "invoked completion for label '$expectedLabel'",
    executeCompletionTestCase
);

test.failing.each(failing_test_table)(
    "invoked completion for label '$expectedLabel'",
    executeCompletionTestCase
);
