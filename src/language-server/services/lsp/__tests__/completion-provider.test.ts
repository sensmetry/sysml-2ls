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

import {
    TEST_BUILD_OPTIONS,
    services,
    parseSysML,
    recursiveObjectContaining,
    findCursor,
} from "../../../../testing";
import { LangiumDocument } from "langium";
import {
    CompletionParams,
    TextDocumentIdentifier,
    CompletionTriggerKind,
    CompletionItem,
} from "vscode-languageserver";

//eslint-disable-next-line @typescript-eslint/ban-types
export type DeepPartial<T> = T extends object | undefined
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

interface Case {
    // use | to denote cursor position
    text: string;
    // TriggerCharacter kind will infer the actual trigger character
    triggerKind?: CompletionTriggerKind;
    expected: DeepPartial<CompletionItem>;
}

const test_table: Case[] = [
    {
        text: `pack|
`,
        expected: {
            label: "package",
        },
    },

    {
        text: `lib|
`,
        expected: {
            label: "library",
        },
    },

    {
        text: `package 'Test' {

    part def Vehicle {
        part eng : Engine;
    }
    part def Engine;
    part def MyEngine :>|
}
`,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        expected: {
            label: "Engine",
        },
    },

    {
        text: `package 'Test' {
    
    enum def TrafficLightColor {
        enum Green;
        enum Yellow;
        enum Red;
    }
    
    currentColor = TrafficLightColor::|
}
`,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        expected: {
            label: "Green",
        },
    },

    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinder;
    part def '1myCylinder' :> Cylinder;
    part engine : Engine {
        part cylinder : '|';
    }
}
`,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        expected: {
            label: "1myCylinder",
        },
    },

    {
        text: `part def Engine;
part engine : Engine {
    part cyl = Engine.|
}
`,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        expected: {
            label: "metadata",
            textEdit: { newText: "metadata" },
        },
    },

    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinders
    part def '6Cylinders' :> Cylinders;
    part engine : Engine {
        part cyls : |
    }
}
`,
        triggerKind: CompletionTriggerKind.Invoked,
        expected: {
            label: "6Cylinders",
            textEdit: { newText: "'6Cylinders'" },
        },
    },

    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinders;
    part def '6Cylinders' :> Cylinders;
}
import myPack::'|
`,
        triggerKind: CompletionTriggerKind.Invoked,
        expected: {
            label: "6Cylinders",
            textEdit: { newText: "6Cylinders'" },
        },
    },

    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinders;
    part def '6Cylinders' :> Cylinders;
}
import myPack::|'
`,
        triggerKind: CompletionTriggerKind.Invoked,
        expected: {
            label: "6Cylinders",
            textEdit: { newText: "'6Cylinders" },
        },
    },

    {
        text: `part a { part b; }
part c : a { :>>| }
`,
        triggerKind: CompletionTriggerKind.Invoked,
        expected: {
            label: "b",
            textEdit: { newText: "b" },
        },
    },

    {
        text: `part a { part b; }
part c : a { :>>| }
`,
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        expected: {
            label: "b",
            textEdit: { newText: "b" },
        },
    },
    {
        text: `package 'Vehicle' {
    part def Cylinder;
    part def Engine {
        part cylinder : Cy|
    }
}
`,
        expected: {
            label: "Cylinder",
        },
    },
    {
        text: `
    part def 'Abstract Ball Corner';
    part Example : 'Abstract Ba|'`,
        expected: {
            label: "Abstract Ball Corner",
        },
    },
    {
        text: `
    part def 'My part';
    part def Part2 :> My|{
        part foo;
    }`,
        expected: {
            label: "My part",
            textEdit: {
                newText: "'My part'",
            },
        },
    },
];

const failing_test_table: Case[] = [
    // Test case currently fails due to parser limitation
    {
        text: `package 'myPack' {
    part def Engine;
    part def Cylinder;
    part def '1MyCylinder' :> Cylinder;
    part engine : Engine {
        part myCylinder : '|
    }
}
`,
        triggerKind: CompletionTriggerKind.Invoked,
        expected: {
            label: "1MyCylinder",
            textEdit: { newText: "1MyCylinder'" },
        },
    },
];

// Builds a document, provides completion params.
async function buildDocumentAndCompletionParams(description: Case): Promise<{
    document: LangiumDocument;
    completionParams: CompletionParams;
}> {
    const { text, cursor } = findCursor(description.text);

    const result = await parseSysML(text);
    const document = result.value.$document;
    expect(document).toBeDefined();
    if (!document) throw new Error();

    const completionParams: CompletionParams = {
        textDocument: TextDocumentIdentifier.create(document.uriString),
        position: document.textDocument.positionAt(cursor),
        context: description.triggerKind
            ? {
                  triggerKind: description.triggerKind,
                  triggerCharacter:
                      description.triggerKind === CompletionTriggerKind.TriggerCharacter
                          ? text.charAt(cursor - 1)
                          : undefined,
              }
            : undefined,
    };

    await services.shared.workspace.DocumentBuilder.build([document], TEST_BUILD_OPTIONS);
    return { document, completionParams };
}

async function executeCompletionTestCase(description: Case): Promise<void> {
    const { document, completionParams } = await buildDocumentAndCompletionParams(description);
    const completionList = await services.SysML.lsp.CompletionProvider?.getCompletion(
        document,
        completionParams
    );
    const expectation = Array.isArray(description.expected)
        ? description.expected
        : [description.expected];

    expect(completionList?.items).toEqual(
        expect.arrayContaining(expectation.map((item) => recursiveObjectContaining(item)))
    );
}

test.concurrent.each(test_table)(
    "invoked completion for label '$expected.label'",
    executeCompletionTestCase
);

test.failing.each(failing_test_table)(
    "invoked completion for label '$expected.label'",
    executeCompletionTestCase
);
