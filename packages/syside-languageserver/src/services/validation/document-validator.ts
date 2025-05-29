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

import {
    AstNode,
    CstNode,
    DefaultDocumentValidator,
    findNodeForKeyword,
    findNodeForProperty,
    interruptAndCheck,
    LangiumDocument,
    toDiagnosticSeverity,
} from "langium";
import { CancellationToken, Diagnostic, Range } from "vscode-languageserver";
import { AstErrorInformation } from "../sysml-validation";
import { SysMLLinker } from "../references/linker";
import { SysMLDefaultServices } from "../services";
import { MetamodelBuilder } from "../shared/workspace/metamodel-builder";
import { sanitizeRange } from "../../utils/common";
import { ElementMeta } from "../../model";
import {
    BaseValidationRegistry,
    ModelDiagnostic,
    ModelDiagnosticInfo,
    ModelValidationAcceptor,
} from "./validation-registry";
import { streamModel } from "../../utils/ast-util";

/**
 * SysML document validator that additionally gathers SysML specific document
 * errors
 */
export class SysMLDocumentValidator extends DefaultDocumentValidator {
    protected readonly linker: SysMLLinker;
    protected readonly metamodelBuilder: MetamodelBuilder;
    protected override validationRegistry: BaseValidationRegistry;

    constructor(services: SysMLDefaultServices) {
        super(services);
        this.linker = services.references.Linker;
        this.metamodelBuilder = services.shared.workspace.MetamodelBuilder;
        this.validationRegistry = services.validation.ValidationRegistry;
    }

    async validateElement<T extends ElementMeta>(
        element: T,
        document: LangiumDocument,
        cancelToken = CancellationToken.None,
        items: ModelDiagnostic[] = []
    ): Promise<ModelDiagnostic[]> {
        const acceptor: ModelValidationAcceptor = <N extends ElementMeta>(
            severity: "error" | "warning" | "info" | "hint",
            message: string,
            info: ModelDiagnosticInfo<N>
        ) => {
            items.push({ severity, message, element: info.element, info });
        };

        const checks = this.validationRegistry.getModelChecks(element.nodeType());
        await Promise.all(checks.map((check) => check(element, acceptor, cancelToken)));
        return items;
    }

    async validateModel(
        rootNode: ElementMeta,
        document: LangiumDocument,
        cancelToken = CancellationToken.None
    ): Promise<ModelDiagnostic[]> {
        const validationItems: ModelDiagnostic[] = [];
        const acceptor: ModelValidationAcceptor = <N extends ElementMeta>(
            severity: "error" | "warning" | "info" | "hint",
            message: string,
            info: ModelDiagnosticInfo<N>
        ) => {
            validationItems.push({ severity, message, element: info.element, info });
        };

        await Promise.all(
            streamModel(rootNode).map(async (node) => {
                await interruptAndCheck(cancelToken);
                const checks = this.validationRegistry.getModelChecks(node.nodeType());
                for (const check of checks) {
                    await check(node, acceptor, cancelToken);
                }
            })
        );
        return validationItems;
    }

    protected override async validateAst(
        rootNode: AstNode,
        document: LangiumDocument<AstNode>,
        cancelToken?: CancellationToken | undefined
    ): Promise<Diagnostic[]> {
        const diagnostics = await this.validateModel(
            rootNode.$meta as ElementMeta,
            document,
            cancelToken
        );

        // don't want to completely rewrite `validateDocument` so mutating
        // document here instead
        diagnostics.forEach((d) => document.modelDiagnostics.add(d.element, d));
        return document.modelDiagnostics
            .values()
            .map((d) => this.fromModelDiagnostic(d))
            .toArray();
    }

    protected fromModelDiagnostic(diagnostic: ModelDiagnostic): Diagnostic {
        return {
            message: diagnostic.message,
            range: getModelDiagnosticRange(diagnostic.info, diagnostic.element),
            severity: toDiagnosticSeverity(diagnostic.severity),
            code: diagnostic.info.code,
            codeDescription: diagnostic.info.codeDescription,
            tags: diagnostic.info.tags,
            relatedInformation: diagnostic.info.relatedInformation,
            data: diagnostic.info.data,
            source: this.getSource(),
        };
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SysMLDocumentValidator {
    export const ImportError = "import-error";
    export const MetamodelError = "metamodel-error";
}

function getDiagnosticRangeImpl(
    info: Omit<AstErrorInformation, "node" | "message">,
    node: AstNode
): Range {
    let cstNode: CstNode | undefined;
    if (info.range) return info.range;
    if (typeof info.property === "string") {
        cstNode = findNodeForProperty(node.$cstNode, info.property, info.index);
    } else if (typeof info.keyword === "string") {
        cstNode = findNodeForKeyword(node.$cstNode, info.keyword, info.index);
    }
    cstNode ??= node.$cstNode;
    if (!cstNode) {
        return {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        };
    }
    return cstNode.range;
}

export function getDiagnosticRange(info: AstErrorInformation): Range {
    // need to sanitize the returned range since CST node ranges may become
    // invalidated by LSP and return end with nulls
    return sanitizeRange(getDiagnosticRangeImpl(info, info.node));
}

const EMPTY_RANGE: Range = { start: { character: 0, line: 0 }, end: { character: 0, line: 0 } };

export function getModelDiagnosticRange(
    info: Omit<ModelDiagnosticInfo<ElementMeta, string>, "element">,
    element: ElementMeta
): Range {
    let node = element.ast();
    if (node) return sanitizeRange(getDiagnosticRangeImpl(info, node));

    let current = element.parent();
    while (current) {
        node = current.ast();
        if (node?.$cstNode) return node.$cstNode.range;
        current = current.parent();
    }

    return EMPTY_RANGE;
}
