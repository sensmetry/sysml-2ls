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

import { Import, Alias, Namespace } from "../../generated/ast";
import { ElementMeta } from "./element";
import { metamodelOf, ElementID } from "../metamodel";
import { BuildState } from "../enums";

@metamodelOf(Namespace)
export class NamespaceMeta extends ElementMeta {
    /**
     * Import statements
     */
    imports: Import[] = [];

    /**
     * Alias members
     */
    aliases: Alias[] = [];

    /**
     * Imports resolution state
     */
    importResolutionState: BuildState = "none";

    constructor(node: Namespace, elementId: ElementID) {
        super(node, elementId);
    }

    override initialize(node: Namespace): void {
        this.imports.push(...node.imports);
        this.aliases.push(...node.aliases);
    }

    override self(): Namespace {
        return super.deref() as Namespace;
    }

    override reset(): void {
        super.reset();
        this.importResolutionState = "none";
        const node = this.self();
        this.imports = [...node.imports];
        this.aliases = [...node.aliases];
    }
}

declare module "../../generated/ast" {
    interface Namespace {
        $meta: NamespaceMeta;
    }
}
