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

import { AstNode, DefaultLangiumDocumentFactory, LangiumDocument, ParseResult } from "langium";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { SysMLSharedServices } from "../../services";
import { SysMLNodeDescription } from "./ast-descriptions";
import { MetamodelBuilder } from "./metamodel-builder";

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
        exports: SysMLNodeDescription[];
    }
}

/**
 * Extension of Langium document factory that extends {@link LangiumDocument}
 * with additional properties used by other SysML services.
 */
export class SysMLDocumentFactory extends DefaultLangiumDocumentFactory {
    protected readonly metamodelBuilder: MetamodelBuilder;

    constructor(services: SysMLSharedServices) {
        super(services);

        this.metamodelBuilder = services.workspace.MetamodelBuilder;
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
        doc.exports = [];

        this.metamodelBuilder.onParsed(doc);
        return doc;
    }
}
