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

import { IMPLICIT_MAP } from "./metamodel";
import { typeIndex } from "./types";
import { SysMLType } from "../services/sysml-ast-reflection";

//! import metamodel types last to let decorators run
import "./KerML";
import "./SysML";

/**
 * Index class for implicit specializations
 */
class SysMLImplicitIndex {
    protected readonly implicitMapping = new Map<string, string>();

    constructor() {
        // build implicit mapping
        const expanded = typeIndex.expandAndMerge(IMPLICIT_MAP);
        for (const [type, implicits] of expanded.entries()) {
            // need to use reverse here so that supertypes are set first and
            // then overridden by most derived types
            for (const [kind, supertype] of implicits.reverse()) {
                this.add(type, kind, supertype);
            }
        }
    }

    protected add(type: SysMLType, kind: string, supertype: string): void {
        this.implicitMapping.set(this.makeKey(type, kind), supertype);
    }

    /**
     * Get a qualified element name from the registered {@link type} and
     * {@link kind} pair. Used by the metamodel builder to add implicit
     * specializations in a generic way.
     */
    get(type: SysMLType, kind = "base"): string {
        return this.implicitMapping.get(this.makeKey(type, kind)) ?? "";
    }

    protected makeKey(type: SysMLType, kind: string): string {
        return `${type}^${kind}`;
    }
}

export const implicitIndex = new SysMLImplicitIndex();
