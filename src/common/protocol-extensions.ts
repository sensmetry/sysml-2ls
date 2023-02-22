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

/* eslint-disable @typescript-eslint/no-namespace */

import { Position, Range, TextDocumentIdentifier } from "vscode-languageserver";
import {
    MessageDirection,
    ProtocolRequestType,
    ProtocolRequestType0,
    RequestHandler,
    RequestHandler0,
} from "vscode-languageserver";

export interface Selection extends Range {
    /**
     * The position at which the selection starts. This position might be before
     * or after {@link Selection.active active}.
     */
    anchor: Position;

    /**
     * The position of the cursor. This position might be before or after
     * {@link Selection.anchor anchor}.
     */
    active: Position;

    /**
     * A selection is reversed if its {@link Selection.anchor anchor} is the
     * {@link Selection.end end} position.
     */
    isReversed: boolean;
}

export interface TextEditor {
    /**
     * The document associated with this text editor. The document will be the
     * same for the entire lifetime of this text editor.
     */
    document: TextDocumentIdentifier;

    /**
     * The primary selection on this text editor. Shorthand for
     * `TextEditor.selections[0]`.
     */
    selection: Selection;

    /**
     * The selections in this text editor. The primary selection is always at
     * index 0.
     */
    selections: readonly Selection[];
}

export namespace RegisterTextEditorCommandsRequest {
    // protocol library doesn't allow passing array messages, unless the
    // parameters are sent by position. However, ProtocolRequestType implicitly
    // sends all parameters by name.
    interface Message {
        commands: string[];
    }
    export const method = "sysml/registerTextEditorCommands";
    export const messageDirection = MessageDirection.serverToClient;
    export const type = new ProtocolRequestType<Message, void, void, void, void>(method);
    export type HandlerSignature = RequestHandler<Message, void, void>;
    export type Parameters = TextEditor;
}

export namespace FindStdlibRequest {
    export const method = "sysml/findStdlib";
    export const messageDirection = MessageDirection.serverToClient;
    // handlers should return the path to the standard library dir and
    // periodically send progress to let the server know the client is alive,
    // otherwise the server assumes that there is no standard library
    export const type = new ProtocolRequestType0<string | null, number, void, void>(method);
    export type HandlerSignature = RequestHandler0<string | null, void>;
    export const ProgressToken = "sysml/findStdlib/progress";
}
