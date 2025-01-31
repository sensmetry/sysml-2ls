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

import { AstNode, isAstNode } from "langium";
import { Range } from "vscode-languageserver";
import { ElementMeta } from "../model/KerML";

export type AstErrorInformation = {
    /**
     * The AST node to which the diagnostic is attached.
     */
    node: AstNode;
    /**
     * Message to show in a diagnostic
     */
    message: string;
    /**
     * If a property name is given, the diagnostic is restricted to the
     * corresponding text region.
     */
    property?: string;
    /**
     * If the value of a keyword is given, the diagnostic will appear at its
     * corresponding text region
     */
    keyword?: string;
    /**
     * In case of a multi-value property (array), an index can be given to
     * select a specific element.
     */
    index?: number;
    /**
     * If you want to create a diagnostic independent to any property, use the
     * range property.
     */
    range?: Range;
};

export type ModelErrorInformation = {
    /**
     * Model element this error is attached to
     */
    model: ElementMeta;

    /**
     * Error message
     */
    message: string;
};

/**
 * Error info for diagnostics
 * @see {@link }
 */
export type ErrorRelatedInformation = AstErrorInformation | ModelErrorInformation;

/**
 * Diagnostics info
 */
export type SysMLError = ErrorRelatedInformation & {
    /**
     * An array of related diagnostic information, e.g. when symbol-names within
     * a scope collide all definitions can be marked via this property.
     */
    relatedInformation?: ErrorRelatedInformation[];
};

export function makeError(
    source: AstNode | ElementMeta,
    info: Omit<SysMLError, "node" | "model">,
    extra?: (node: AstNode) => Omit<Partial<AstErrorInformation>, "node">
): SysMLError {
    if (!isAstNode(source)) {
        const ast = source.ast();
        if (ast) {
            return { ...info, node: ast, ...extra?.call(undefined, ast) };
        }
        return { ...info, model: source };
    }

    return { ...info, node: source, ...extra?.call(undefined, source) };
}
