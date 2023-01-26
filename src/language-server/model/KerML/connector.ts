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

import { Connector, ConnectorEnd } from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { FeatureMeta } from "./feature";

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
    readonly ends: ConnectorEnd[] = [];

    constructor(node: Connector, id: ElementID) {
        super(node, id);
    }

    override initialize(node: Connector): void {
        this.ends.push(...node.ends);
    }

    override defaultSupertype(): string {
        const ends = this.ends.length;

        if (this.hasStructureType()) {
            return ends === 2 ? "binaryObject" : "object";
        }

        return ends === 2 ? "binary" : "base";
    }

    override self(): Connector {
        return super.deref() as Connector;
    }

    override reset(): void {
        super.reset();
        this.ends.length = 0;
        this.ends.push(...this.self().ends);
    }
}

declare module "../../generated/ast" {
    interface Connector {
        $meta: ConnectorMeta;
    }
}
