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
    AstNode,
    BuildOptions,
    DefaultDocumentBuilder,
    DocumentState,
    LangiumDocument,
} from "langium";
import { CancellationToken, Disposable } from "vscode-languageserver";
import { SysMLSharedServices } from "../../services";
import { erase, mergeWithPartial, Statistics, Timer } from "../../../utils/common";
import { URI } from "vscode-uri";
import { performance } from "perf_hooks";
import { BuildProgress } from "./documents";
import { SysMLConfigurationProvider } from "./configuration-provider";

export type StandardLibrary = "none" | "standard" | "local";
export interface SysMLBuildOptions extends BuildOptions {
    /**
     * Set type of standard library:
     *  'none' - skip setting up relationships to the standard library elements
     *  'standard' - use default standard library
     *  'local' - use standard library elements from the document locally, useful for testing
     */
    standardLibrary?: StandardLibrary;

    /**
     * If set, ignore all metamodel errors
     */
    ignoreMetamodelErrors?: boolean;

    /**
     * If true, the document will be built isolated from all the other
     * documents, i.e. no indexing, no global scope. It's main use is for
     * testing so that each new built file doesn't pollute the global scope and
     * influence other test results.
     */
    standalone?: boolean;
}

declare module "langium" {
    interface LangiumDocument {
        /**
         * Options used to build this document
         */
        buildOptions?: SysMLBuildOptions;
    }
}

export type DocumentPhaseListener = (document: LangiumDocument) => void;

export class SysMLDocumentBuilder extends DefaultDocumentBuilder {
    protected readonly statistics: Statistics;
    protected readonly config: SysMLConfigurationProvider;
    /**
     * Map of document URIs to times they were opened in ms
     */
    protected readonly openDocuments = new Map<string, number>();

    /**
     * Listeners for one-by-one document updates
     */
    protected readonly documentPhaseListeners: Record<DocumentState, DocumentPhaseListener[]> = {
        [DocumentState.Changed]: [],
        [DocumentState.Parsed]: [],
        [DocumentState.IndexedContent]: [],
        [DocumentState.ComputedScopes]: [],
        [DocumentState.Linked]: [],
        [DocumentState.IndexedReferences]: [],
        [DocumentState.Validated]: [],
    };

    constructor(services: SysMLSharedServices) {
        super(services);
        this.statistics = services.statistics;
        this.config = services.workspace.ConfigurationProvider;

        const builder = services.workspace.MetamodelBuilder;

        // make sure that metamodels are in a clean state on changed documents
        // before rebuilding them
        this.onBuildPhase(DocumentState.Parsed, async (docs) => {
            docs.forEach((d) => builder.onChanged(d));
        });

        // tracking of open documents to skip document unnecessary updates
        services.workspace.TextDocuments.onDidOpen((e) => {
            this.openDocuments.set(e.document.uri, performance.now());
        });
        services.workspace.TextDocuments.onDidClose((e) => {
            this.openDocuments.delete(e.document.uri);
        });
    }

    protected override async buildDocuments(
        documents: LangiumDocument<AstNode>[],
        options: SysMLBuildOptions,
        cancelToken: CancellationToken
    ): Promise<void> {
        if (documents.length === 0) return;
        try {
            documents.forEach((doc) => (doc.progress = BuildProgress.Building));
            await this.buildDocumentsImpl(documents, options, cancelToken);
            documents.forEach((doc) => (doc.progress = BuildProgress.Completed));
        } catch (e) {
            documents.forEach((doc) => (doc.progress = BuildProgress.Canceled));
            throw e;
        }
    }

    protected async buildDocumentsImpl(
        documents: LangiumDocument<AstNode>[],
        options: SysMLBuildOptions,
        cancelToken: CancellationToken
    ): Promise<void> {
        this.statistics.reset();
        options = mergeWithPartial(this.config.get().defaultBuildOptions, options);

        // make sure the additional members exist before any other service tries
        // to access them
        documents.forEach((doc) => {
            doc.buildOptions = options;
        });

        if (this.config.get().logStatistics) {
            console.log(
                `Building documents:${documents
                    .map((d) => `\n\t${d.uri.toString()} [${DocumentState[d.state]}]`)
                    .join()}`
            );
        }

        await super.buildDocuments(documents, options, cancelToken);

        this.reportStats();
    }

    /**
     * Print build time statistics to console
     */
    protected reportStats(): void {
        if (!this.config.get().logStatistics || this.statistics.isEmpty()) return;
        const entries = Object.entries(this.statistics.dump());
        const stats = entries.map(
            ([name, [elapsed, hits]]) =>
                `\n\t${name}: ${elapsed.toFixed(3)} ms in ${hits} hits (avg: ${(
                    elapsed / hits
                ).toFixed(3)} ms)`
        );
        const total = entries.reduce((total, [_, [elapsed, __]]) => total + elapsed, 0);
        console.log(`Build statistics ${total.toFixed(3)} ms:${stats}`);
    }

    protected override async runCancelable(
        documents: LangiumDocument<AstNode>[],
        targetState: DocumentState,
        cancelToken: CancellationToken,
        callback: (document: LangiumDocument<AstNode>) => unknown
    ): Promise<void> {
        const timer = new Timer();

        await super.runCancelable(documents, targetState, cancelToken, async (doc) => {
            await callback(doc);
            this.notifyEarlyBuildPhase(doc, targetState);
        });

        if (!this.config.get().logStatistics) return;

        console.log(
            `${cancelToken.isCancellationRequested ? "Canceled" : "Completed"} ${
                DocumentState[targetState]
            } in ${timer.elapsed().toFixed(3)} ms`
        );
    }

    /**
     * Notify listeners that {@link document} has reached {@link state}
     */
    protected notifyEarlyBuildPhase(document: LangiumDocument, state: DocumentState): void {
        for (const listener of this.documentPhaseListeners[state]) {
            listener(document);
        }
    }

    override async update(
        changed: URI[],
        deleted: URI[],
        cancelToken?: CancellationToken | undefined
    ): Promise<void> {
        // TODO: add a frequency (period) limiter between specific doc updates
        // to prevent this from being called too often on one document, will
        // save CPU power and discard duplicate updates like content update and
        // document savings

        // While following references, if the referenced symbol is in a closed
        // document, VS Code will quickly open and close the document also
        // firing `TextDocuments.onDidChangeContent` event. Detect such event by
        // skipping update on changed documents that have been already built but
        // haven't been opened for long
        changed = changed.filter((uri) => {
            // update if the document doesn't exist yet
            if (!this.langiumDocuments.hasDocument(uri)) return true;
            const openingTime = this.openDocuments.get(uri.toString());
            // update if the document is still closed
            if (!openingTime) return true;
            // update if the document has been open for a while
            if (performance.now() - openingTime > 10) return true;
            const document = this.langiumDocuments.getOrCreateDocument(uri);
            // update if the document hasn't been fully built yet
            return document.state < DocumentState.Validated;
        });

        if (changed.length === 0 && deleted.length === 0) return;
        return super.update(changed, deleted, cancelToken);
    }

    /**
     * Register a listener on each built document reaching {@link targetState}.
     * Since listeners will be called after once for *each* document reaching
     * {@link targetState}, {@link callback} should not perform any long-running
     * tasks.
     * @param targetState State on which {@link callback} will be executed
     * @param callback
     * @returns Disposable that unregisters this callback
     */
    onDocumentPhase(targetState: DocumentState, callback: DocumentPhaseListener): Disposable {
        this.documentPhaseListeners[targetState].push(callback);
        return Disposable.create(() => {
            erase(this.documentPhaseListeners[targetState], callback);
        });
    }
}
