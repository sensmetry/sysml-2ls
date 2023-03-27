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
import { Association } from "../../generated/ast";
import { TypeClassifier } from "../enums";
import { ElementID, metamodelOf, ModelContainer } from "../metamodel";
import { ConnectorMixin } from "../mixins/connector";
import { ClassifierMeta, RelationshipMeta } from "./_internal";

export const ImplicitAssociations = {
    base: "Links::Link",
    binary: "Links::BinaryLink",
};

@metamodelOf(Association, ImplicitAssociations)
// Note: inherited methods are override by the last class inside `Mixin`
export class AssociationMeta extends Mixin(ConnectorMixin, RelationshipMeta, ClassifierMeta) {
    private baseEnds: number | undefined = undefined;

    constructor(elementId: ElementID, parent: ModelContainer<Association>) {
        super(elementId, parent);
    }

    protected override setupClassifiers(): void {
        this.classifier = TypeClassifier.Association;
    }

    override defaultSupertype(): string {
        return this.isBinary() ? "binary" : "base";
    }

    override ast(): Association | undefined {
        return this._ast as Association;
    }

    override parent(): ModelContainer<Association> {
        return this._parent;
    }

    override reset(_: Association): void {
        this.localEnds = undefined;
        this.baseEnds = undefined;
    }

    /**
     * @returns Total number of ends from inherited types
     */
    inheritedEnds(): number {
        if (this.baseEnds === undefined) {
            this.baseEnds = this.typesMatching(Association).reduce((count, assoc) => {
                return Math.max(count, assoc.totalEnds());
            }, 0);
        }

        return this.baseEnds;
    }

    /**
     * @returns Total number of ends including inherited ones
     */
    totalEnds(): number {
        return Math.max(this.ownedEnds().length, this.inheritedEnds());
    }

    /**
     * Whether this Association is binary
     */
    isBinary(): boolean {
        return this.totalEnds() === 2;
    }
}

declare module "../../generated/ast" {
    interface Association {
        $meta: AssociationMeta;
    }
}
