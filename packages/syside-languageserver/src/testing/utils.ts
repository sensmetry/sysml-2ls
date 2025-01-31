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

import { createSysMLServices } from "../sysml-module";
import { SysMLNodeFileSystem } from "../node/node-file-system-provider";
import {
    DeepPartial,
    DocumentValidator,
    LangiumDocument,
    ParseResult as LangiumParseResult,
} from "langium";
import { URI } from "vscode-uri";
import { Element, Namespace } from "../../src/generated/ast";
import { Diagnostic } from "vscode-languageserver";
import { SysMLBuildOptions } from "../services/shared/workspace/document-builder";
import { makeLinkingScope, makeScope, SysMLScope } from "../utils/scopes";
import { SysMLConfig } from "../services/config";
import { Visibility } from "../utils/scope-util";
import { expect } from "@jest/globals";
import { BasicMetamodel, PrintRange, RelationshipMeta, attachNotes } from "../model";
import { SysMLType, SysMLInterface } from "../services";

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
    validationChecks: "none",
    standardLibrary: "none",
    standalone: true,
};

export interface ParseOptions extends SysMLBuildOptions {
    build?: boolean;
}

async function buildDocument(
    text: string,
    uri: URI,
    options: ParseOptions & { document?: true } = TEST_BUILD_OPTIONS
): Promise<ParseResult | LangiumDocument<Namespace>> {
    const document = factory.fromString<Namespace>(text, uri);
    if (options.build !== false)
        await services.shared.workspace.DocumentBuilder.build([document], options);
    if (options.document) return document;
    return {
        parserErrors: document.parseResult.parserErrors,
        lexerErrors: document.parseResult.lexerErrors,
        value: document.parseResult.value,
        diagnostics: document.diagnostics ?? [],
    };
}

export async function parseKerML(
    text: string,
    options: Partial<ParseOptions> & { document: true }
): Promise<LangiumDocument<Namespace>>;
export async function parseKerML(text: string, options?: ParseOptions): Promise<ParseResult>;

export async function parseKerML(
    text: string,
    options: ParseOptions & { document?: true } = TEST_BUILD_OPTIONS
): Promise<ParseResult | LangiumDocument<Namespace>> {
    return buildDocument(text, URI.file(generateString(16) + ".kerml"), options);
}

export async function parseSysML(
    text: string,
    options: Partial<ParseOptions> & { document: true }
): Promise<LangiumDocument<Namespace>>;
export async function parseSysML(text: string, options?: ParseOptions): Promise<ParseResult>;

export async function parseSysML(
    text: string,
    options: ParseOptions & { document?: true } = TEST_BUILD_OPTIONS
): Promise<ParseResult | LangiumDocument<Namespace>> {
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
    return { $meta: { to: { reference_: name } } };
}

export function qualifiedTarget(name: string): object {
    return { $meta: { to: { target: { qualifiedName: name } } } };
}

export function defaultLinkingErrorTo(name: string): object {
    return {
        code: DocumentValidator.LinkingError,
        message: expect.stringMatching(
            new RegExp(`Could not resolve reference to [\\w_\\d]+ named '${name}'.*$`)
        ),
    };
}

function collectNames(scope: SysMLScope): string[] {
    return scope
        .getAllExportedElements()
        .map(([_, m]) => m)
        .map((member) => member.element()?.qualifiedName)
        .nonNullable()
        .distinct()
        .toArray();
}

export function childrenNames(
    namespace: Element | undefined,
    inherited = Visibility.public,
    imported = Visibility.public
): string[] {
    if (!namespace) return [];
    return collectNames(
        makeScope(namespace.$meta, {
            inherited: { visibility: inherited, depth: 100000 },
            imported: { visibility: imported, depth: 100000 },
        })
    );
}

export function directScopeNames(namespace: Namespace): string[] {
    return collectNames(makeLinkingScope(namespace.$meta, { skipParents: true }));
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

declare module "../model/metamodel" {
    interface BasicMetamodel {
        toJSON(): Record<string, unknown>;
    }
}

BasicMetamodel.prototype.toJSON = function (this: BasicMetamodel): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key in this) {
        if (key.startsWith("_")) continue;
        const value = (this as unknown as Record<string, unknown>)[key];
        if (typeof value === "function") continue;
        out[key] = value;
    }

    out["$type"] = this.nodeType();
    return out;
};

RelationshipMeta.prototype.toJSON = function (this: RelationshipMeta): Record<string, unknown> {
    const out: Record<string, unknown> = BasicMetamodel.prototype.toJSON.call(this);
    if (this.element()) out.element = this.element();

    return out;
};

declare module "langium" {
    interface LangiumDocument {
        toJSON?: () => unknown;
    }
}

/**
 * Patch a document so that it works with `JSON.stringify`
 * @param doc
 * @returns
 */
export function patchDocument(doc: LangiumDocument): LangiumDocument {
    doc.toJSON = function (this: LangiumDocument): unknown {
        return {
            ...this,
            parseResult: {
                ...this.parseResult,
                value: undefined,
            },
            astNodes: undefined,
        };
    };

    return doc;
}

export function emptyDocument(
    name?: string,
    suffix: ".kerml" | ".sysml" = ".sysml"
): LangiumDocument {
    const document = services.shared.workspace.LangiumDocumentFactory.fromString(
        "",
        URI.file((name ?? generateString(8)) + suffix)
    );

    patchDocument(document);

    return document;
}

export async function parsedNode<K extends SysMLType>(
    text: string,
    options: {
        build?: boolean;
        lang?: "sysml" | "kerml";
        node: K;
        index?: number;
    }
): Promise<SysMLInterface<K>> {
    const lang = options.lang ?? "kerml";
    const doc = await (lang === "kerml" ? parseKerML : parseSysML)(text, {
        document: true,
        build: options.build ? true : false,
    });
    expect(doc.parseResult.lexerErrors).toHaveLength(0);
    expect(doc.parseResult.parserErrors).toHaveLength(0);

    attachNotes(doc);

    const index = options.index ?? 0;
    let current = -1;
    const node = doc.astNodes.find((node) => node.$type === options.node && ++current === index);
    expect(node).toBeDefined();
    return node as SysMLInterface<K>;
}

export const getRange = (text: string): { text: string; range: PrintRange } => {
    const first = text.indexOf("|");
    const last = text.lastIndexOf("|");
    return {
        text: text.replaceAll("|", ""),
        range: {
            offset: first,
            end: last - 1,
        },
    };
};
