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
    CstNode,
    DefaultDocumentValidator,
    DiagnosticInfo,
    findNodeForKeyword,
    findNodeForProperty,
    getDocument,
    LangiumDocument,
} from "langium";
import {
    CancellationToken,
    Diagnostic,
    Range,
    DiagnosticRelatedInformation,
} from "vscode-languageserver";
import { ErrorRelatedInformation, SysMLError } from "../sysml-validation";
import { SysMLLinker } from "../references/linker";
import { SysMLDefaultServices } from "../services";
import { MetamodelBuilder } from "../shared/workspace/metamodel-builder";
import { sanitizeRange } from "../../utils/common";

/**
 * SysML document validator that additionally gathers SysML specific document
 * errors
 */
export class SysMLDocumentValidator extends DefaultDocumentValidator {
    protected readonly linker: SysMLLinker;
    protected readonly metamodelBuilder: MetamodelBuilder;

    constructor(services: SysMLDefaultServices) {
        super(services);
        this.linker = services.references.Linker;
        this.metamodelBuilder = services.shared.workspace.MetamodelBuilder;
    }

    protected createDiagnostic(
        severity: "error" | "warning" | "info" | "hint",
        code: string | number | undefined,
        error: SysMLError
    ): Diagnostic {
        const info: DiagnosticInfo<AstNode, string> = {
            node: error.node,
            property: error.property,
            keyword: error.keyword,
            index: error.index,
            code: code,
            range: getDiagnosticRange(error),
            relatedInformation: error?.relatedInformation?.map((related) => {
                const i: DiagnosticRelatedInformation = {
                    message: related.message,
                    location: {
                        uri: getDocument(related.node).uriString,
                        range: getDiagnosticRange(related),
                    },
                };
                return i;
            }),
        };
        return this.toDiagnostic(severity, error.message, info);
    }

    override async validateDocument(
        document: LangiumDocument<AstNode>,
        cancelToken?: CancellationToken | undefined
    ): Promise<Diagnostic[]> {
        const diagnostics = await super.validateDocument(document, cancelToken);

        // collect import errors
        for (const importError of this.linker.getImportErrors(document)) {
            const diagnostic = this.createDiagnostic(
                "error",
                SysMLDocumentValidator.ImportError,
                importError
            );
            diagnostics.push(diagnostic);
        }

        // collect metamodel errors
        if (!document.buildOptions?.ignoreMetamodelErrors) {
            for (const metamodelError of this.metamodelBuilder.getMetamodelErrors(document)) {
                const diagnostic = this.createDiagnostic(
                    "error",
                    SysMLDocumentValidator.MetamodelError,
                    metamodelError
                );
                diagnostics.push(diagnostic);
            }
        }

        return diagnostics;
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SysMLDocumentValidator {
    export const ImportError = "import-error";
    export const MetamodelError = "metamodel-error";
}

function getDiagnosticRangeImpl(info: ErrorRelatedInformation): Range {
    let cstNode: CstNode | undefined;
    if (info.range) return info.range;
    if (typeof info.property === "string") {
        cstNode = findNodeForProperty(info.node.$cstNode, info.property, info.index);
    } else if (typeof info.keyword === "string") {
        cstNode = findNodeForKeyword(info.node.$cstNode, info.keyword, info.index);
    }
    cstNode ??= info.node.$cstNode;
    if (!cstNode) {
        return {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        };
    }
    return cstNode.range;
}

export function getDiagnosticRange(info: ErrorRelatedInformation): Range {
    // need to sanitize the returned range since CST node ranges may become
    // invalidated by LSP and return end with nulls
    return sanitizeRange(getDiagnosticRangeImpl(info));
}
