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

import { Element, TransparentElement } from "../generated/ast";
import { ElementMeta } from "./KerML/element";
import { Metamodel } from "./metamodel";

/**
 * Sanitize a name that was parsed from source files.
 * @param name
 * @returns name that can be used in reference resolution
 */
export function sanitizeName(name: undefined): undefined;
export function sanitizeName(name: string): string;
export function sanitizeName(name?: string): string | undefined;

export function sanitizeName(name?: string): string | undefined {
    if (!name || name.length === 0) return;
    if (!name.startsWith("'")) return name;
    return name.slice(1, name.length - 1).replaceAll(/\\([btnfr"'\\])/g, (substr, match) => {
        switch (match) {
            case "b":
                return "\b";
            case "t":
                return "\t";
            case "n":
                return "\n";
            case "f":
                return "\f";
            case "r":
                return "\r";
            case "'":
                return "'";
            // eslint-disable-next-line quotes
            case '"':
                // eslint-disable-next-line quotes
                return '"';
            case "\\":
                return "\\";
        }
        return match;
    });
}

const SimpleNameRegex = /^[_a-zA-Z][\w_\d]*$/;

/**
 * Escape name so that it is a valid identifier in source file, assuming it is
 * not a keyword.
 * @see {@link sanitizeName}
 */
export function unsanitizeName(name: string): string {
    return SimpleNameRegex.test(name)
        ? name
        : `'${name.replaceAll(/([\b\t\n\f\r'\\])/g, (_, match) => {
              switch (match) {
                  case "\b":
                      return "\\b";
                  case "\t":
                      return "\\t";
                  case "\n":
                      return "\\n";
                  case "\f":
                      return "\\f";
                  case "\r":
                      return "\\r";
                  case "'":
                      return "\\'";
                  case "\\":
                      return "\\\\";
              }

              return match;
          })}'`;
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
export function computeQualifiedName(meta: ElementMeta, parent: Metamodel | undefined): string {
    let name = getName(meta);
    let parentName = "";
    while (parent?.owner()) {
        if (!parent.is(TransparentElement)) {
            if (parent.is(Element)) {
                return concatNames(parent.qualifiedName, name);
            } else {
                parentName = parent.elementId.toString() ?? "<unnamed>";
            }

            name = concatNames(parentName, name);
        }
        parent = parent.owner();
    }
    return name;
}

export class Name {
    protected _declared: string | undefined;
    protected _name: string | undefined;

    constructor(name?: string) {
        this.set(name);
    }

    /**
     * Name as was parsed/provided
     */
    get declared(): string | undefined {
        return this._declared;
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
        this._declared = name;
        this._name = sanitizeName(name);
    }
}
