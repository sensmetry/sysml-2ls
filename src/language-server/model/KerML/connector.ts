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

import { Connector } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { Related, ConnectorEndMeta, FeatureMeta } from "./_internal";

export const ImplicitConnectors = {
    base: "Links::links",
    binary: "Links::binaryLinks",
    object: "Objects::linkObjects",
    binaryObject: "Objects::binaryLinkObjects",
};

@metamodelOf(Connector, ImplicitConnectors)
export class ConnectorMeta extends FeatureMeta {
    /**
     * Owned connector ends
     */
    ends: Related<ConnectorEndMeta>[] = [];

    constructor(id: ElementID, parent: ModelContainer<Connector>) {
        super(id, parent);
    }

    override initialize(node: Connector): void {
        this.ends = node.ends.map((end) => ({ element: end.$meta }));
    }

    override defaultSupertype(): string {
        const ends = this.ends.length;

        if (this.hasStructureType()) {
            return ends === 2 ? "binaryObject" : "object";
        }

        return ends === 2 ? "binary" : "base";
    }

    override self(): Connector | undefined {
        return super.deref() as Connector;
    }

    override parent(): ModelContainer<Connector> {
        return this._parent;
    }

    override reset(node: Connector): void {
        this.initialize(node);
    }
}

declare module "../../generated/ast" {
    interface Connector {
        $meta: ConnectorMeta;
    }
}
