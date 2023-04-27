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

import { GenericLanguageClient, MaybePromise } from "./sysml-language-client";

export interface ServerConfig {
    args: {
        /**
         * Command line interface arguments in release mode
         */
        run: (string | number)[];

        /**
         * Command line interface arguments in debug mode
         */
        debug: (string | number)[];
    };

    /**
     * Server entry path, relative paths will be resolved from the first workspace folder
     */
    path?: string;
}

export interface LanguageClientExtension<T = unknown> {
    /**
     * Called before the server and client are started
     * @param context extension context, i.e. `vscode.ExtensionContext` in VS Code
     * @param config current server config
     */
    onBeforeStart(context: T, config: ServerConfig): MaybePromise<void>;

    /**
     * Called after the server has been started
     * @param context extension context, i.e. `vscode.ExtensionContext` in VS Code
     * @param client the language client, i.e. `LanguageClient` in VS Code
     */
    onStarted(context: T, client: GenericLanguageClient): MaybePromise<void>;

    /**
     * Called in `deactivate` hook of the language client extensions
     * @param client the language client, i.e. `LanguageClient` in VS Code
     */
    onDeactivate(client: GenericLanguageClient): MaybePromise<void>;
}

const ExtensionKeys = ["onBeforeStart", "onStarted", "onDeactivate"] as const;
type TypesAreEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
type StaticAssert<T extends true> = T;

// eslint-disable-next-line unused-imports/no-unused-vars
type AllKeysCovered = StaticAssert<
    TypesAreEqual<keyof LanguageClientExtension, (typeof ExtensionKeys)[number]>
>;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace LanguageClientExtension {
    export function is(o: unknown): o is LanguageClientExtension {
        return (
            typeof o === "object" &&
            o !== null &&
            ExtensionKeys.every(
                (key) => key in o && typeof (o as Record<string, unknown>)[key] === "function"
            )
        );
    }
}
