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

import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { AstNode, LangiumDocument, LangiumServices } from "langium";
import { URI } from "vscode-uri";
import type { WorkspaceFolder } from "vscode-languageserver";
import type { SysMLBuildOptions } from "syside-languageserver";

export type Options = SysMLBuildOptions & {
    validate?: boolean;
};

export async function extractDocument<T extends AstNode>(
    fileName: string,
    extensions: string[],
    services: LangiumServices,
    { validate = false, standardLibrary = "standard" }: Options = {}
): Promise<LangiumDocument<T>> {
    if (!extensions.includes(path.extname(fileName))) {
        console.error(
            chalk.yellow(`Please, choose a file with one of these extensions: ${extensions}.`)
        );
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} doesn't exist.`));
        process.exit(1);
    }

    const document = services.shared.workspace.LangiumDocuments.getOrCreateDocument(
        URI.file(path.resolve(fileName))
    );
    const buildOptions: SysMLBuildOptions = {
        validationChecks: validate ? "all" : "none",
        standardLibrary: standardLibrary,
    };
    await services.shared.workspace.DocumentBuilder.build([document], buildOptions);

    const validationErrors = (document.diagnostics ?? []).filter((e) => e.severity === 1);
    if (validationErrors.length > 0) {
        console.error(chalk.red("There are validation errors:"));
        for (const validationError of validationErrors) {
            console.error(
                chalk.red(
                    `line ${validationError.range.start.line + 1}: ${
                        validationError.message
                    } [${document.textDocument.getText(validationError.range)}]`
                )
            );
        }
        process.exit(1);
    }

    return document as LangiumDocument<T>;
}

export async function extractAstNode<T extends AstNode>(
    fileName: string,
    extensions: string[],
    services: LangiumServices
): Promise<T> {
    return (await extractDocument(fileName, extensions, services)).parseResult.value as T;
}

export async function setRootFolder(
    fileName: string,
    services: LangiumServices,
    root?: string
): Promise<void> {
    if (!root) {
        root = path.dirname(fileName);
    }
    if (!path.isAbsolute(root)) {
        root = path.resolve(process.cwd(), root);
    }
    const folders: WorkspaceFolder[] = [
        {
            name: path.basename(root),
            uri: URI.file(root).toString(),
        },
    ];
    await services.shared.workspace.WorkspaceManager.initializeWorkspace(folders);
}

interface FilePathData {
    destination: string;
    name: string;
}

export function extractDestinationAndName(
    filePath: string,
    destination: string | undefined
): FilePathData {
    filePath = path.basename(filePath, path.extname(filePath)).replace(/[.-]/g, "");
    return {
        destination: destination ?? path.join(path.dirname(filePath), "generated"),
        name: path.basename(filePath),
    };
}
