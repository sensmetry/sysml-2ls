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

import { Feature } from "../../generated/ast";
import { ElementID, FeatureChainingMeta, FeatureMeta, ParentModel } from "../../model";

class ElementIdProvider {
    private count = 0;

    next(): number {
        // sequential IDs are simple and fast but may not be best if used as
        // hash keys
        return this.count++;
    }
}

/**
 * Utilities for working with the internal model. This is a class instead of the
 * methods being free functions for easier integration with ESBuild as it merges
 * all used modules into one and then singletons are different per module.
 */
export class ModelUtil {
    protected provider = new ElementIdProvider();

    /**
     *
     * @returns An element ID for use when creating internal models programmatically
     */
    createId(): ElementID {
        return this.provider.next();
    }

    /**
     * Constructs a feature chaining from {@link chained} to {@link chaining}
     * @param chained
     * @param chaining
     * @returns {@link chained}
     */
    addChainingFeature(chained: FeatureMeta, chaining: FeatureMeta): FeatureMeta {
        const relationship = new FeatureChainingMeta(this.createId(), chained);
        relationship.setElement(chaining);
        chained.chainings.push(relationship);
        return chained;
    }

    /**
     * Constructs a feature that chains all {@link features}
     * @param parent the constructed feature parent
     * @param features chaining features
     * @returns
     */
    chainFeatures(parent: ParentModel<Feature>, ...features: FeatureMeta[]): FeatureMeta {
        const chained = new FeatureMeta(this.createId(), parent);
        for (const feature of features) {
            const chaining = feature.chainingFeatures;
            if (chaining.length === 0) this.addChainingFeature(chained, feature);
            else chaining.forEach((f) => this.addChainingFeature(chained, f));
        }

        return chained;
    }
}
