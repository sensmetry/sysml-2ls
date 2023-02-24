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

import { Classifier, Feature, Multiplicity } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { FeatureMeta } from "./feature";

export const ImplicitMultiplicities = {
    base: "Base::naturals",
    feature: "Base::exactlyOne",
    classifier: "Base::zeroOrOne",
};

@metamodelOf(Multiplicity, ImplicitMultiplicities)
export class MultiplicityMeta extends FeatureMeta {
    constructor(id: ElementID, parent: ModelContainer<Multiplicity>) {
        super(id, parent);
    }

    override self(): Multiplicity | undefined {
        return super.deref() as Multiplicity;
    }

    override parent(): ModelContainer<Multiplicity> {
        return this._parent;
    }

    override defaultSupertype(): string {
        const owner = this.parent();
        if (owner.is(Classifier)) return "classifier";
        if (owner.is(Feature)) return "feature";
        return "base";
    }
}

declare module "../../generated/ast" {
    interface Multiplicity {
        $meta: MultiplicityMeta;
    }
}
