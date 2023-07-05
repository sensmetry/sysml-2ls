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

import { Mixin } from "ts-mixer";
import { ConnectionDefinition } from "../../generated/ast";
import { AssociationStructMeta, AssociationStructureOptions } from "../KerML/association-structure";
import { metamodelOf } from "../metamodel";
import { PartDefinitionMeta, PartDefinitionOptions } from "./part-definition";
import { InheritanceMeta, TypeMeta } from "../KerML";

export interface ConnectionDefinitionOptions
    extends AssociationStructureOptions,
        PartDefinitionOptions {}

@metamodelOf(ConnectionDefinition, {
    base: "Connections::Connection",
    binary: "Connections::BinaryConnection",
})
export class ConnectionDefinitionMeta extends Mixin(AssociationStructMeta, PartDefinitionMeta) {
    override defaultSupertype(): string {
        return AssociationStructMeta.prototype.defaultSupertype.call(this);
    }

    override ast(): ConnectionDefinition | undefined {
        return this._ast as ConnectionDefinition;
    }

    protected override onHeritageAdded(heritage: InheritanceMeta, target: TypeMeta): void {
        this.resetEnds();
        PartDefinitionMeta.prototype["onHeritageAdded"].call(this, heritage, target);
    }

    protected override onHeritageRemoved(heritage: InheritanceMeta[]): void {
        this.resetEnds();
        PartDefinitionMeta.prototype["onHeritageRemoved"].call(this, heritage);
    }
}

declare module "../../generated/ast" {
    interface ConnectionDefinition {
        $meta: ConnectionDefinitionMeta;
    }
}
