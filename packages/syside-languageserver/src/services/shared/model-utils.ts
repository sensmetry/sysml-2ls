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

import {
    ElementID,
    ElementIDProvider,
    FeatureChainingMeta,
    FeatureMeta,
    basicIdProvider,
} from "../../model";

/**
 * Utilities for working with the internal model. This is a class instead of the
 * methods being free functions for easier integration with ESBuild as it merges
 * all used modules into one and then singletons are different per module.
 */
export class ModelUtil {
    readonly idProvider: ElementIDProvider = basicIdProvider();

    /**
     *
     * @returns An element ID for use when creating internal models programmatically
     */
    createId(): ElementID {
        return this.idProvider();
    }

    /**
     * Constructs a feature chaining from {@link chained} to {@link chaining}
     * @param chained
     * @param chaining
     * @returns {@link chained}
     */
    addChainingFeature(chained: FeatureMeta, chaining: FeatureMeta): FeatureMeta {
        const relationship = FeatureChainingMeta.create(this.idProvider, chained.document);
        chained.addFeatureRelationship([relationship, chaining]);
        return chained;
    }

    /**
     * Constructs a feature that chains all {@link features}
     * @param features chaining features
     * @returns
     */
    chainFeatures(feature: FeatureMeta, ...features: FeatureMeta[]): FeatureMeta {
        const chained = FeatureMeta.create(this.idProvider, feature.document);

        for (const feat of [feature, ...features]) {
            const chaining = feat.chainingFeatures;
            if (chaining.length === 0) this.addChainingFeature(chained, feat);
            else chaining.forEach((f) => this.addChainingFeature(chained, f));
        }

        return chained;
    }
}
