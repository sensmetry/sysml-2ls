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

import { FeatureValue } from "../../../generated/ast";
import { ElementID, metamodelOf, ModelContainer, ParentModel } from "../../metamodel";
import { ExpressionMeta, FeatureMeta, OwningMembershipMeta } from "../_internal";

@metamodelOf(FeatureValue)
export class FeatureValueMeta<
    T extends ExpressionMeta = ExpressionMeta
> extends OwningMembershipMeta<T> {
    isDefault = false;
    isInitial = false;

    constructor(id: ElementID, parent: ModelContainer<FeatureValue>) {
        super(id, parent);
    }

    override initialize(node: FeatureValue): void {
        this.isDefault = node.isDefault;
        this.isInitial = node.isInitial;

        (this.parent() as FeatureMeta).value = this;
    }

    override ast(): FeatureValue | undefined {
        return this._ast as FeatureValue;
    }

    override parent(_: true): ParentModel<FeatureValue>;
    override parent(): ModelContainer<FeatureValue>;

    override parent(): ModelContainer<FeatureValue> {
        return this._parent;
    }
}

declare module "../../../generated/ast" {
    interface FeatureValue {
        $meta: FeatureValueMeta;
    }
}
