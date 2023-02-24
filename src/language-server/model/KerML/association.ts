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

import { Association } from "../../generated/ast";
import { TypeClassifier } from "../enums";
import { ClassifierMeta } from "./classifier";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { stream } from "langium";

export const ImplicitAssociations = {
    base: "Links::Link",
    binary: "Links::BinaryLink",
};

@metamodelOf(Association, ImplicitAssociations)
export class AssociationMeta extends ClassifierMeta {
    // cached end counts
    private localEnds: number | undefined = undefined;
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

    override self(): Association | undefined {
        return super.deref() as Association;
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
     * @returns Number of directly owned end features
     */
    ownedEnds(): number {
        if (this.localEnds === undefined) {
            this.localEnds = stream(this.features)
                .filter((f) => f.element.isEnd)
                .count();
        }

        return this.localEnds;
    }

    /**
     * @returns Total number of ends including inherited ones
     */
    totalEnds(): number {
        return Math.max(this.ownedEnds(), this.inheritedEnds());
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
