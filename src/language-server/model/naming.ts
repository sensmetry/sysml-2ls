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

// For now, only strips the parsed quotes to make it possible to reference KerML
// members that match SysML keywords
// TODO: escape special characters as in spec?

import { AstNode } from "langium";
import { isElement, isTransparentElement } from "../generated/ast";
import { ElementMeta } from "./KerML/element";

/**
 * Sanitize a name
 * @param name
 * @returns name that can be used in reference resolution
 */
export function sanitizeName(name: undefined): undefined;
export function sanitizeName(name: string): string;
export function sanitizeName(name?: string): string | undefined;

export function sanitizeName(name?: string): string | undefined {
    if (!name) return;
    if (name.startsWith("'")) return name.slice(1, name.length - 1);
    return name;
}

/**
 * Concatenate two names {@link left} and {@link right}
 */
export function concatNames(left: string, right: string): string {
    return left + "::" + right;
}

/**
 * Get a string name of an element with {@link meta}
 */
export function getName(meta: ElementMeta): string {
    return meta.rawName ?? meta.rawShortName ?? meta.elementId.toString();
}

/**
 * Compute a fully qualified name
 * @param name name to use for this node
 * @param parent parent node
 * @returns Fully qualified name
 */
export function computeQualifiedName(meta: ElementMeta, parent: AstNode | undefined): string {
    let name = getName(meta);
    let parentName = "";
    while (parent?.$container) {
        if (!isTransparentElement(parent)) {
            if (isElement(parent)) {
                parentName = getName(parent.$meta);
            } else {
                parentName = parent.$meta?.elementId.toString() ?? "<unnamed>";
            }

            name = concatNames(parentName, name);
        }
        parent = parent.$container;
    }
    return name;
}

export class Name {
    protected _raw: string | undefined;
    protected _name: string | undefined;

    constructor(name?: string) {
        this.set(name);
    }

    /**
     * Name as was parsed/provided
     */
    get raw(): string | undefined {
        return this._raw;
    }

    /**
     * Name to be used in reference resolution
     */
    get sanitized(): string | undefined {
        return this._name;
    }

    /**
     * Set new name
     */
    set(name: string | undefined): void {
        this._raw = name;
        this._name = sanitizeName(name);
    }
}
