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

import { AstNode, Formatter, LangiumDocument, MaybePromise } from "langium";
import {
    CancellationToken,
    DocumentFormattingParams,
    DocumentOnTypeFormattingOptions,
    DocumentOnTypeFormattingParams,
    DocumentRangeFormattingParams,
    Range,
    TextEdit,
} from "vscode-languageserver";
import {
    ContextOptions,
    NamespaceMeta,
    attachNotes,
    collectPrintRange,
    defaultKerMLPrinterContext,
    defaultSysMLPrinterContext,
    printModelElement,
    printModelRange,
} from "../../model";
import { Utils } from "vscode-uri";
import { PrinterConfig, printDoc } from "../../utils";
import { SysMLConfigurationProvider } from "../shared";
import { SysMLDefaultServices } from "../services";

export type integer = number;
export interface LanguageSettings {
    /**
     * Number of columns the formatter will try to fit source text into.
     * @default 120
     */
    lineWidth: integer;
}

export class SysMLFormatter implements Formatter {
    protected readonly config: SysMLConfigurationProvider;

    constructor(services: SysMLDefaultServices) {
        this.config = services.shared.workspace.ConfigurationProvider;
    }

    protected get contextOptions(): ContextOptions {
        return {
            forceFormatting: false,
            format: this.config.get().formatting,
            highlighting: false,
        };
    }

    async formatDocument(
        document: LangiumDocument<AstNode>,
        params: DocumentFormattingParams,
        _cancelToken?: CancellationToken | undefined
    ): Promise<TextEdit[]> {
        if (
            document.parseResult.parserErrors.length > 0 ||
            document.parseResult.lexerErrors.length > 0
        )
            return [];

        attachNotes(document);
        const ext = Utils.extname(document.uri);
        const doc = printModelElement(
            document.parseResult.value.$meta as NamespaceMeta,
            ext === ".sysml"
                ? defaultSysMLPrinterContext(this.contextOptions)
                : defaultKerMLPrinterContext(this.contextOptions)
        );

        const formatted = printDoc(doc, await this.getPrinterOptions(document, params)).text;

        return [
            TextEdit.replace(
                Range.create(
                    document.textDocument.positionAt(0),
                    document.textDocument.positionAt(document.textDocument.getText().length)
                ),
                formatted
            ),
        ];
    }
    formatDocumentRange(
        document: LangiumDocument<AstNode>,
        params: DocumentRangeFormattingParams,
        cancelToken?: CancellationToken | undefined
    ): MaybePromise<TextEdit[]> {
        return this.doFormatRange(document, params.range, params, cancelToken);
    }

    formatDocumentOnType(
        document: LangiumDocument<AstNode>,
        params: DocumentOnTypeFormattingParams,
        cancelToken?: CancellationToken | undefined
    ): MaybePromise<TextEdit[]> {
        return this.doFormatRange(
            document,
            Range.create(params.position, params.position),
            params,
            cancelToken
        );
    }

    /* istanbul ignore */
    get formatOnTypeOptions(): DocumentOnTypeFormattingOptions | undefined {
        return;
    }

    protected async doFormatRange(
        document: LangiumDocument<AstNode>,
        range: Range,
        params: DocumentFormattingParams,
        _cancelToken?: CancellationToken | undefined
    ): Promise<TextEdit[]> {
        if (
            document.parseResult.parserErrors.length > 0 ||
            document.parseResult.lexerErrors.length > 0
        )
            return [];

        attachNotes(document);
        const ext = Utils.extname(document.uri);
        const printRange = collectPrintRange(document, {
            offset: document.textDocument.offsetAt(range.start),
            end: document.textDocument.offsetAt(range.end),
        });

        if (!printRange) return [];

        const doc = printModelRange(
            printRange,
            ext === ".sysml"
                ? defaultSysMLPrinterContext(this.contextOptions)
                : defaultKerMLPrinterContext(this.contextOptions)
        );

        // printing an inner range so a final new line doesn't make sense here
        const options = await this.getPrinterOptions(document, params);
        options.addFinalNewline = false;
        const formatted = printDoc(doc, options).text;

        const editRange = Range.create(
            document.textDocument.positionAt(printRange.range.offset),
            document.textDocument.positionAt(printRange.range.end)
        );
        return [TextEdit.replace(editRange, formatted)];
    }

    protected async getPrinterOptions(
        document: LangiumDocument,
        params: DocumentFormattingParams
    ): Promise<PrinterConfig> {
        const lineWidth: number | undefined =
            (await this.config.getConfiguration(
                Utils.extname(document.uri).replace(".", ""),
                "syside.formatter.lineWidth"
            )) ?? this.config.get().formatting.lineWidth;

        const text = document.textDocument.getText();
        const newlinePos = text.lastIndexOf("\n");
        return {
            lineEnd: text.charAt(newlinePos - 1) === "\r" ? "\r\n" : "\n",
            lineWidth: lineWidth ?? 100,
            tabWidth: params.options.tabSize,
            useSpaces: params.options.insertSpaces,
            addFinalNewline:
                params.options.insertFinalNewline || document.textDocument.getText().endsWith("\n"),
            highlighting: false,
        };
    }
}
