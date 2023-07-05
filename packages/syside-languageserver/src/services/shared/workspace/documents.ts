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
    DefaultLangiumDocumentFactory,
    DefaultLangiumDocuments,
    LangiumDocument,
    MultiMap,
    ParseResult,
} from "langium";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { streamAst } from "../../../utils";
import { SysMLSharedServices } from "../../services";
import { MetamodelBuilder } from "./metamodel-builder";
import { SysMLConfigurationProvider } from "./configuration-provider";
import { performance } from "perf_hooks";
import { ElementMeta } from "../../../model";
import { ModelDiagnostic } from "../../validation";

export const enum BuildProgress {
    Created = 0,
    Building = 1,
    Completed = 2,
    Canceled = 3,
}

declare module "langium" {
    interface LangiumDocument {
        /**
         * Cached `document.uri.toString()` since it is used often and a lot of
         * places as a map key
         */
        uriString: string;

        /**
         * Overall document build progress
         */
        progress: BuildProgress;

        /**
         * Local document exports
         */
        exports: Map<string, ElementMeta>;

        /**
         * Lazy cache of fully qualified element names to element descriptions
         * locally in this document
         */
        namedElements: Map<string, ElementMeta | null>;

        /**
         * Flattened tree of parsed AST nodes in this document
         */
        astNodes: AstNode[];

        /**
         * Model element diagnostics
         */
        modelDiagnostics: MultiMap<ElementMeta, ModelDiagnostic>;

        /**
         * Register additional clean up callbacks to be called on document
         * invalidation
         */
        onInvalidated: MultiMap<ElementMeta, () => void>;
    }
}

/**
 * Extension of Langium document factory that extends {@link LangiumDocument}
 * with additional properties used by other SysML services.
 */
export class SysMLDocumentFactory extends DefaultLangiumDocumentFactory {
    protected readonly metamodelBuilder: MetamodelBuilder;
    protected readonly config: SysMLConfigurationProvider;

    constructor(services: SysMLSharedServices) {
        super(services);

        this.metamodelBuilder = services.workspace.MetamodelBuilder;
        this.config = services.workspace.ConfigurationProvider;
    }

    override update<T extends AstNode = AstNode>(document: LangiumDocument<T>): LangiumDocument<T> {
        const doc = super.update(document);
        return this.onCreated(doc);
    }

    protected override createLangiumDocument<T extends AstNode = AstNode>(
        parseResult: ParseResult<T>,
        uri: URI,
        textDocument?: TextDocument,
        text?: string
    ): LangiumDocument<T> {
        const doc = super.createLangiumDocument(parseResult, uri, textDocument, text);
        return this.onCreated(doc);
    }

    protected onCreated<T extends AstNode>(doc: LangiumDocument<T>): LangiumDocument<T> {
        doc.uriString = doc.uri.toString();
        doc.progress = BuildProgress.Created;
        doc.exports = new Map();
        doc.namedElements = new Map();
        doc.astNodes = streamAst(doc.parseResult.value).toArray();
        doc.modelDiagnostics = new MultiMap();
        doc.onInvalidated = new MultiMap();

        this.metamodelBuilder.onParsed(doc);
        return doc;
    }

    protected override parse<T extends AstNode>(uri: URI, text: string): ParseResult<T> {
        if (!this.config.get().logStatistics) return super.parse<T>(uri, text);
        const start = performance.now();
        const result = super.parse<T>(uri, text);
        console.info(`Parsed ${uri.toString()} in ${(performance.now() - start).toFixed(2)} ms`);
        return result;
    }
}

export class SysMLDocuments extends DefaultLangiumDocuments {
    override invalidateDocument(uri: URI): LangiumDocument<AstNode> | undefined {
        const doc = super.invalidateDocument(uri);
        if (doc) {
            doc.progress = BuildProgress.Created;
            doc.exports.clear();
            doc.namedElements.clear();
            doc.modelDiagnostics.clear();
            doc.onInvalidated.values().forEach((cb) => cb());
            doc.onInvalidated.clear();
            // no need to invalidate cached AST nodes since the document is not
            // reparsed here
        }

        return doc;
    }

    override deleteDocument(uri: URI): LangiumDocument<AstNode> | undefined {
        const doc = super.deleteDocument(uri);
        doc?.onInvalidated.values().forEach((cb) => cb());

        return doc;
    }
}
