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

import { SysMLClientExtender } from "syside-languageclient";
import * as vscode from "vscode";
import { TextEditor } from "syside-protocol";
import { TextDocumentIdentifier } from "vscode-languageserver";

/**
 * SysML language client for VS Code.
 */
export abstract class BaseSysMLVSCodeClientExtender extends SysMLClientExtender {
    protected readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        super();
        this.context = context;
    }

    protected registerTextEditorCommand(
        command: string,
        execute: (editor: TextEditor) => Promise<unknown>
    ): void {
        const disposable = vscode.commands.registerTextEditorCommand(command, (editor) =>
            execute({
                document: TextDocumentIdentifier.create(editor.document.uri.toString()),
                selection: editor.selection,
                selections: editor.selections,
            })
        );
        this.context.subscriptions.push(disposable);
    }
}
