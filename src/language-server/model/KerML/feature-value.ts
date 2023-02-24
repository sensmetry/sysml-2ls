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

import { FeatureValue } from "../../generated/ast";
import { metamodelOf, BasicMetamodel, ElementID, ModelContainer, ParentModel } from "../metamodel";
import { castToRelated, InlineExpressionMeta } from "./_internal";

@metamodelOf(FeatureValue)
export class FeatureValueMeta extends BasicMetamodel<FeatureValue> {
    element?: InlineExpressionMeta;

    isDefault = false;
    isInitial = false;

    constructor(id: ElementID, parent: ModelContainer<FeatureValue>) {
        super(id, parent);
    }

    override initialize(node: FeatureValue): void {
        this.element = node.expression.$meta;
        this.isDefault = node.isDefault;
        this.isInitial = node.isInitial;

        this.parent(true).value = castToRelated(this);
    }

    override self(): FeatureValue | undefined {
        return super.self() as FeatureValue;
    }

    override parent(_: true): ParentModel<FeatureValue>;
    override parent(): ModelContainer<FeatureValue>;

    override parent(): ModelContainer<FeatureValue> {
        return this._parent;
    }
}

declare module "../../generated/ast" {
    interface FeatureValue {
        $meta: FeatureValueMeta;
    }
}
