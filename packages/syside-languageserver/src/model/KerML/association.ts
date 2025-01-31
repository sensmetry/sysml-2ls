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

import { Mixin } from "ts-mixer";
import { Association } from "../../generated/ast";
import { TypeClassifier } from "../enums";
import { ElementID, metamodelOf } from "../metamodel";
import { ConnectorMixin } from "../mixins/connector";
import {
    ClassifierMeta,
    ClassifierOptions,
    InheritanceMeta,
    RelationshipMeta,
    TypeMeta,
} from "./_internal";
import { Class } from "ts-mixer/dist/types/types";

export const ImplicitAssociations = {
    base: "Links::Link",
    binary: "Links::BinaryLink",
};

export type AssociationOptions = ClassifierOptions;

@metamodelOf(Association, ImplicitAssociations)
// Note: inherited methods are override by the last class inside `Mixin`
export class AssociationMeta extends Mixin(
    ConnectorMixin,
    RelationshipMeta as Class<[ElementID], RelationshipMeta, typeof RelationshipMeta>,
    ClassifierMeta
) {
    protected override _classifier = TypeClassifier.Association;

    override defaultSupertype(): string {
        return this.isBinary() ? "binary" : "base";
    }

    override ast(): Association | undefined {
        return this._ast as Association;
    }

    protected override onHeritageAdded(heritage: InheritanceMeta, target: TypeMeta): void {
        this.resetEnds();
        ClassifierMeta.prototype["onHeritageAdded"].call(this, heritage, target);
    }

    protected override onHeritageRemoved(heritage: InheritanceMeta[]): void {
        this.resetEnds();
        ClassifierMeta.prototype["onHeritageRemoved"].call(this, heritage);
    }
}

declare module "../../generated/ast" {
    interface Association {
        $meta: AssociationMeta;
    }
}
