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

import { ElementMeta } from "./KerML";
import { Relationship } from "../generated/ast";

interface SExpOptions {
    includeElementId: boolean;
    includeImplicit: boolean;
    includeTargets: boolean;
    indent: number;
    recursive: boolean;
}

function isImplied(node: ElementMeta): boolean {
    const parent = node.parent();
    return (
        (node.is(Relationship) && node.isImplied) ||
        (!!parent && parent?.is(Relationship) && parent?.isImplied)
    );
}

export function toSExp(
    node: ElementMeta,
    depth = 0,
    options: SExpOptions = {
        includeElementId: false,
        includeImplicit: true,
        includeTargets: true,
        indent: 2,
        recursive: true,
    }
): string {
    const finish = (out: string[]): string => {
        out.push(")");
        return out.join("");
    };

    const out = ["\n", " ".repeat(depth * options.indent), `(${node.nodeType()}`];

    if (node.shortName) {
        out.push(` <${node.shortName}>`);
    }
    if (node.name) {
        out.push(` ${node.name}`);
    }
    if (options.includeElementId) {
        out.push(` [id:${node.elementId}]`);
    }
    if (isImplied(node)) {
        out.push(` (implicit)`);
    }
    if (!options.recursive) {
        return finish(out);
    }

    const exps = node
        .ownedElements()
        .filter((elem) => !isImplied(elem) || options.includeImplicit)
        .map((elem: ElementMeta) => toSExp(elem, depth + 1, options))
        .toArray();

    out.push(...exps);

    if (exps.length === 0 && options.includeTargets && node.is(Relationship)) {
        const element = node.element();
        if (element) {
            out.push(
                toSExp(element, depth + 1, {
                    ...options,
                    recursive: false,
                })
            );
        }
    }

    return finish(out);
}
