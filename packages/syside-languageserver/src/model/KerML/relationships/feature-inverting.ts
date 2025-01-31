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

import { AstNode, LangiumDocument } from "langium";
import { FeatureInverting } from "../../../generated/ast";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import { ElementMeta, FeatureMeta, RelationshipMeta, RelationshipOptions } from "../_internal";

@metamodelOf(FeatureInverting)
export class FeatureInvertingMeta<T extends FeatureMeta = FeatureMeta> extends RelationshipMeta<T> {
    /**
     * Adds new owned body elements and returns the new number of body elements.
     */
    addChild(...element: ElementMeta[]): number {
        return this.addOwnedElements(this._children, element);
    }

    /**
     * Removes owned body elements and returns the new number of body elements.
     */
    removeChild(...element: ElementMeta[]): number {
        return this.removeOwnedElements(this._children, element);
    }

    /**
     * Removes owned body elements by predicate and returns the new number of
     * body elements.
     */
    removeChildIf(predicate: (element: ElementMeta) => boolean): number {
        return this.removeOwnedElementsIf(this._children, predicate);
    }

    override ast(): FeatureInverting | undefined {
        return this._ast as FeatureInverting;
    }

    static override create<T extends AstNode, Parent extends FeatureMeta | RelationshipMeta>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: RelationshipOptions<FeatureMeta, Parent, FeatureMeta>
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../../generated/ast" {
    interface FeatureInverting {
        $meta: FeatureInvertingMeta;
    }
}
