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

import path from "path";
import fs from "fs";
import { createSysMLServices } from "../src/sysml-module";
import { URI, Utils } from "vscode-uri";
import { LangiumDocument, LangiumSharedServices } from "langium";
import { Diagnostic, Position, Range } from "vscode-languageserver";
import * as ExpectedDiagnostics from "./expected-diagnostics.json";
import { Command } from "commander";
import { SysMLNodeFileSystem } from "../src/node/node-file-system-provider";

function equalPosition(lhs: Position, rhs: Position): boolean {
    return lhs.line === rhs.line && lhs.character === rhs.character;
}

function equalRanges(lhs: Range, rhs: Range): boolean {
    return equalPosition(lhs.start, rhs.start) && equalPosition(lhs.end, rhs.end);
}

function diagnosticsFilterDeleting(d: Diagnostic, expected: Diagnostic[]): boolean {
    const index = expected.findIndex((expected) => {
        return (
            d.code === expected.code &&
            // d.message === expected.message &&
            d.severity === expected.severity &&
            d.source === expected.source &&
            equalRanges(d.range, expected.range)
        );
    });
    if (index < 0) return true;

    // remove the found diagnostics so that the remainder can be used to check
    // if all expected diagnostics were found
    expected.splice(index, 1);

    return false;
}

function findSubmodule(): URI {
    // find the submodule dir
    let dir = __dirname;

    while (dir && !fs.existsSync(path.join(dir, ".git"))) {
        dir = path.join(dir, "..");
    }

    if (!dir) {
        console.error("Could not find root dir!");
        process.exit(-1);
    }

    const releaseDir = path.join(dir, "SysML-v2-Release");

    if (!fs.existsSync(releaseDir)) {
        console.error(`Could not find ${releaseDir}`);
        process.exit(-1);
    }

    return URI.parse(releaseDir);
}

// gather all KerML and SysML docs
async function collectDocuments(
    submodule: URI,
    services: LangiumSharedServices
): Promise<LangiumDocument[]> {
    const fileExtensions = services.ServiceRegistry.all.flatMap(
        (e) => e.LanguageMetaData.fileExtensions
    );

    const provider = services.workspace.FileSystemProvider;
    const nodes = await provider.readDirectory(submodule);
    const uris: URI[] = [];

    for (const node of nodes) {
        if (node.isDirectory) {
            nodes.push(...(await provider.readDirectory(node.uri)));
            continue;
        }

        if (fileExtensions.includes(Utils.extname(node.uri))) uris.push(node.uri);
    }

    return uris.map((uri) => services.workspace.LangiumDocuments.getOrCreateDocument(uri));
}

// Build collected documents
async function buildDocuments(
    docs: LangiumDocument[],
    services: LangiumSharedServices
): Promise<void> {
    console.info("Building documents...");
    await services.workspace.DocumentBuilder.build(docs, { validationChecks: "all" });
    console.info("Built documents.");
}

// Check all documents for diagnostics
function validate(docs: LangiumDocument[], exportDiagnostics = false, ignoreKnown = false): number {
    console.info("Collecting validations...");
    const diagnostics: { [doc: string]: { found: Diagnostic[]; expected: Diagnostic[] } } = {};

    for (const doc of docs) {
        if (!doc.diagnostics) continue;
        const relPath = path.relative(__dirname, doc.uri.path);
        const expected = Array.from(
            (ExpectedDiagnostics as Record<string, Diagnostic[]>)[relPath] ?? []
        );
        const docDiagnostics =
            exportDiagnostics || ignoreKnown
                ? doc.diagnostics
                : doc.diagnostics.filter((diag) => diagnosticsFilterDeleting(diag, expected));

        if (docDiagnostics.length === 0 && expected.length === 0) continue;
        diagnostics[relPath] = {
            found: docDiagnostics,
            expected: ignoreKnown ? [] : expected,
        };
    }

    if (exportDiagnostics) {
        const str = JSON.stringify(
            diagnostics,
            (_, v) => {
                // only return the found diagnostics, don't need expected ones
                // in export
                if (typeof v === "object" && "found" in v && Array.isArray(v.found)) {
                    return v.found.length > 0 ? v.found : undefined;
                }
                return v;
            },
            2
        );
        const file = path.join(__dirname, "expected-diagnostics.json");
        fs.writeFileSync(path.join(__dirname, "expected-diagnostics.json"), str + "\n");
        console.log(`Exported found diagnostics to ${file}`);
        return 0;
    }

    // print found errors and exit
    const entries = Object.entries(diagnostics);
    if (entries.length === 0) {
        console.info("No validation errors found!");
        return 0;
    }

    let count = 0;
    let expected = 0;
    console.warn("Found validation errors!");
    const print = (document: LangiumDocument | undefined, d: Diagnostic): void =>
        console.info(
            // +1 for editor equivalent numbering
            `  Line ${d.range.start.line + 1}|${d.range.start.character + 1}: ${d.message} (${
                d.code
            }) [${document?.textDocument.getText(d.range)}]`
        );

    const documents = Object.fromEntries(docs.map((doc) => [doc.uriString, doc]));
    for (const [doc, diagnostics] of entries) {
        const docpath = path.join(__dirname, doc);
        const uri = URI.file(docpath);
        const document = documents[uri.toString()];
        console.info(`${uri.toString()} had ${diagnostics.found.length} diagnostics:`);
        diagnostics.found.forEach((d) => print(document, d));

        if (diagnostics.expected.length > 0) {
            console.info(` Also expected ${diagnostics.expected.length} other diagnostics:`);
            diagnostics.expected.forEach((d) => print(document, d));
            expected += diagnostics.expected.length;
        }

        console.info("");
        count += diagnostics.found.length;
    }

    console.info(`Found validation errors: ${count}, expected: ${expected} more`);

    return 1;
}

async function run(exportDiagnostics = false, ignoreKnown = false): Promise<number> {
    const submodule = findSubmodule();
    const services = createSysMLServices(SysMLNodeFileSystem, {
        standardLibrary: false,
        standardLibraryPath: Utils.joinPath(submodule, "sysml.library").path,
        skipWorkspaceInit: true,
        debug: {
            scopeInLinkingErrors: "types",
        },
    });
    const docs = await collectDocuments(submodule, services.shared);
    await buildDocuments(docs, services.shared);
    return validate(docs, exportDiagnostics, ignoreKnown);
}

async function main(): Promise<void> {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require("../package.json").version);

    program
        .option("-e, --export", "Export found diagnostics", false)
        .option("-i, --ignore-expected", "Ignore expected diagnostics", false);
    program.parse(process.argv);

    const options = program.opts();
    process.exit(await run(options.export, options.ignoreExpected));
}

main().catch((reason) => {
    console.error(`Validation failed with ${reason}`);
    if (reason instanceof Error) console.error(reason.stack);
    process.exit(-1);
});
