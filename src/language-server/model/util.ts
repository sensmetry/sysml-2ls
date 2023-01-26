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

import { AstNode, AstNodeDescription } from "langium";
import { Visibility } from "../utils/ast-util";
import { isAlias, isVisibilityElement } from "../generated/ast";

export function hasPublicVisibility(node: unknown): boolean {
    return isVisibilityElement(node) ? node.$meta.visibility == Visibility.public : true;
}

export function hasPrivateVisibility(node: unknown): boolean {
    return isVisibilityElement(node) ? node.$meta.visibility == Visibility.private : false;
}

export function hasProtectedVisibility(node: unknown): boolean {
    return isVisibilityElement(node) ? node.$meta.visibility == Visibility.protected : false;
}

export function isInheritable(node: unknown): boolean {
    return !hasPrivateVisibility(node);
}

export function isImportable(node: unknown): boolean {
    return hasPublicVisibility(node);
}

export function isImportableFilter(value: AstNodeDescription): boolean {
    return value.node ? isImportable(value.node) : false;
}

export function isInheritableFilter(value: AstNodeDescription): boolean {
    return value.node ? isInheritable(value.node) : false;
}

export function isVisible(d: AstNodeDescription | undefined, visibility: Visibility): boolean {
    const node = d?.node;
    if (!isVisibilityElement(node)) return true;
    return node.$meta.visibility <= visibility;
}

export function visibilityFilter(
    visibility: Visibility
): (description: AstNodeDescription | undefined) => boolean {
    return (description) => isVisible(description, visibility);
}

/**
 * Follow through alias to get a node matching `fn` predicate
 * @param node Alias or AstNode
 * @param fn type predicate
 * @returns node for which `fn` returns true or undefined otherwise
 */
export function resolveAlias<T extends AstNode>(
    node: AstNode,
    fn: (n: unknown) => n is T
): T | undefined {
    if (isAlias(node)) {
        const ref = node.$meta.for.target;
        if (ref && fn(ref.node)) return ref.node;
        return undefined;
    }
    return fn(node) ? node : undefined;
}

/**
 * Same as `resolveAlias` but without type checking
 * @param node
 * @returns
 */
export function followAlias(node: AstNode | undefined): AstNode | undefined {
    if (isAlias(node)) {
        return node.$meta.for.target?.node;
    }
    return node;
}

/**
 * Trim an annotation body as it was parsed by removing terminators and
 * potentially leading * characters on each line
 * @param body annotation body string as it was parsed
 * @param isMarkdown if true, trim {@link body} for markdown presentation -
 * preserve whitespace and the end of each line
 * @returns trimmed annotation body
 */
export function prettyAnnotationBody(body: string, isMarkdown = true): string {
    body = body.trim();
    body = body.replace("/*", "").trimStart();
    if (body.endsWith("*/")) body = body.substring(0, body.length - 2).trimEnd();

    const lines = body.split(/\r?\n/);

    lines.forEach((line, index) => {
        // trailing whitespace has meaning in markdown
        line = isMarkdown ? line.trimLeft() : line.trim();
        if (line.startsWith("*")) {
            line = line.replace(/^\* ?/, "");
        }

        lines[index] = line;
    });

    return lines.join("\n");
}
