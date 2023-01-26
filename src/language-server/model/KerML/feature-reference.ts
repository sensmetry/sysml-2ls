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

import { Feature, FeatureReference } from "../../generated/ast";
import { Target } from "../../utils/containers";
import { TypeReferenceMeta } from "./type-reference";
import { metamodelOf, ElementID } from "../metamodel";

@metamodelOf(FeatureReference)
export class FeatureReferenceMeta extends TypeReferenceMeta {
    override readonly to = new Target<Feature>();

    /**
     * Array of chain indices that should resolve to features
     */
    readonly featureIndices: number[] = [];

    constructor(node: FeatureReference, id: ElementID) {
        super(node, id);
    }

    override initialize(node: FeatureReference): void {
        // TODO: do this modification in parsing step, or rewrite the rule as an
        // alternative since LL(*) works now
        if (node.prefix) {
            // workaround for Langium discarding parsed results if a new type is
            // inferred
            node.chain.unshift(...node.prefix.chain);
            // TODO: this may screw formatting, make sure it doesn't
            node.prefix = undefined;
        }

        if (this.text) {
            // TODO: use $refText.length to find separators as unrestricted
            // names may have separators themselves

            // handle chains
            const features = this.text.split(".");
            let count = -1;
            for (const name of features) {
                count += name.split("::").length;
                this.featureIndices.push(count);
            }
        } else {
            this.featureIndices.push(0);
        }
    }

    /**
     * Whether this feature reference is a chain
     */
    get isChain(): boolean {
        return this.featureIndices.length > 1;
    }

    override self(): FeatureReference {
        return super.deref() as FeatureReference;
    }
}

declare module "../../generated/ast" {
    interface FeatureReference {
        $meta: FeatureReferenceMeta;
    }
}
