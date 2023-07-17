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

import { DefaultLanguageServer } from "langium";
import { InitializeParams, InitializeResult } from "vscode-languageserver";
import { SUPPORTED_TRIGGER_CHARACTERS } from "./completion-provider";
import { DefaultSysMLSemanticTokenOptions } from "../../model/semantic-tokens";

export class SysMLLanguageServer extends DefaultLanguageServer {
    protected override buildInitializeResult(params: InitializeParams): InitializeResult {
        const result = super.buildInitializeResult(params);

        // register custom tokens here, Langium doesn't expose any way to
        // register custom tokens currently
        if (result.capabilities.semanticTokensProvider) {
            result.capabilities.semanticTokensProvider = DefaultSysMLSemanticTokenOptions;
        }

        // register custom trigger characters for completion provider, Langium
        // doesn't expose nor handle trigger characters currently
        if (result.capabilities.completionProvider) {
            result.capabilities.completionProvider.triggerCharacters = [
                ...SUPPORTED_TRIGGER_CHARACTERS,
            ];
        }

        return result;
    }
}
