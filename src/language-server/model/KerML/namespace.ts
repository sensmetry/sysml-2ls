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

import { Namespace } from "../../generated/ast";
import { ElementMeta } from "./element";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { BuildState } from "../enums";
import { ImportMeta, AliasMeta } from "./_internal";

@metamodelOf(Namespace)
export class NamespaceMeta extends ElementMeta {
    /**
     * Import statements
     */
    imports: ImportMeta[] = [];

    /**
     * Alias members
     */
    aliases: AliasMeta[] = [];

    /**
     * Imports resolution state
     */
    importResolutionState: BuildState = "none";

    constructor(elementId: ElementID, parent: ModelContainer<Namespace>) {
        super(elementId, parent);
    }

    override initialize(node: Namespace): void {
        this.imports = node.imports.map((v) => v.$meta);
        this.aliases = node.aliases.map((v) => v.$meta);
    }

    override self(): Namespace | undefined {
        return super.deref() as Namespace;
    }

    override parent(): ModelContainer<Namespace> {
        return this._parent;
    }

    override reset(node: Namespace): void {
        this.importResolutionState = "none";
        this.initialize(node);
    }
}

declare module "../../generated/ast" {
    interface Namespace {
        $meta: NamespaceMeta;
    }
}
