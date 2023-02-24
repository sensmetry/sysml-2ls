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

import { createSysMLServices } from "../language-server/sysml-module";
import { SysMLNodeFileSystem } from "../language-server/node/node-file-system-provider";
import { DeepPartial, DocumentValidator, ParseResult as LangiumParseResult } from "langium";
import { URI } from "vscode-uri";
import { Element, Namespace } from "../../src/language-server/generated/ast";
import { Diagnostic } from "vscode-languageserver";
import { SysMLBuildOptions } from "../language-server/services/shared/workspace/document-builder";
import { makeLinkingScope, makeScope } from "../language-server/utils/scopes";
import { SysMLConfig } from "../language-server/services/config";
import { Visibility } from "../language-server/utils/scope-util";

export const TEST_SERVER_OPTIONS: DeepPartial<SysMLConfig> = {
    // don't parse the standard library
    standardLibrary: false,
    logStatistics: false,
    defaultBuildOptions: {
        standalone: true,
    },
};

export const services = createSysMLServices(SysMLNodeFileSystem, TEST_SERVER_OPTIONS);
const factory = services.shared.workspace.LangiumDocumentFactory;
const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateString(length: number): string {
    let result = " ";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

export type ParseResult = LangiumParseResult<Namespace> & {
    diagnostics: Diagnostic[];
};

export const TEST_BUILD_OPTIONS: SysMLBuildOptions = {
    validationChecks: "all",
    standardLibrary: "none",
    standalone: true,
};

async function buildDocument(
    text: string,
    uri: URI,
    options: SysMLBuildOptions = TEST_BUILD_OPTIONS
): Promise<ParseResult> {
    const document = factory.fromString<Namespace>(text, uri);
    await services.shared.workspace.DocumentBuilder.build([document], options);
    return {
        parserErrors: document.parseResult.parserErrors,
        lexerErrors: document.parseResult.lexerErrors,
        value: document.parseResult.value,
        diagnostics: document.diagnostics ?? [],
    };
}

export async function parseKerML(
    text: string,
    options: SysMLBuildOptions = TEST_BUILD_OPTIONS
): Promise<ParseResult> {
    return buildDocument(text, URI.file(generateString(16) + ".kerml"), options);
}

export async function parseSysML(
    text: string,
    options: SysMLBuildOptions = TEST_BUILD_OPTIONS
): Promise<ParseResult> {
    return buildDocument(text, URI.file(generateString(16) + ".sysml"), options);
}

export function anything(count: number): object[] {
    return Array(count).fill({});
}

export function withQualifiedName(name: string): object {
    return { $meta: { qualifiedName: name } };
}

export function qualifiedReference(name: string): object {
    return { ref: withQualifiedName(name) };
}

export function qualifiedTypeReference(name: string): object {
    return { $meta: { to: { element: { qualifiedName: name } } } };
}

export function defaultLinkingErrorTo(name: string): object {
    return {
        code: DocumentValidator.LinkingError,
        message: expect.stringMatching(
            new RegExp(`Could not resolve reference to [\\w_\\d]+ named '${name}'.*$`)
        ),
    };
}

export function childrenNames(
    namespace: Namespace,
    inherited = Visibility.public,
    imported = Visibility.public
): string[] {
    return Array.from(
        makeScope(namespace.$meta, {
            inherited: { visibility: inherited, depth: 100000 },
            imported: { visibility: imported, depth: 100000 },
        })
            .getAllElements()
            .map((d) => (d.node as Element).$meta.qualifiedName)
    );
}

export function directScopeNames(namespace: Namespace): string[] {
    return Array.from(
        makeLinkingScope(namespace.$meta, { skipParents: true })
            .getAllElements()
            .map((d) => (d.node as Element).$meta.qualifiedName)
    );
}

/**
 * Find and extract cursor offset from {@link text}
 * @param text text with "|" for cursor position
 * @returns text with "|" removed and cursor offset
 */
export function findCursor(text: string): { text: string; cursor: number } {
    const cursor = text.indexOf("|");
    text = text.substring(0, cursor) + text.substring(cursor + 1);

    if (cursor < 0) {
        throw new Error("No cursor found!");
    }

    return { text, cursor };
}
