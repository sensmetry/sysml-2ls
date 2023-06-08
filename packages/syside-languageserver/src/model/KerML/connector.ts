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

import { stream } from "langium";
import { Mixin } from "ts-mixer";
import { Connector, ReferenceSubsetting } from "../../generated/ast";
import { metamodelOf } from "../metamodel";
import { ConnectorMixin } from "../mixins/connector";
import {
    ElementParts,
    EndFeatureMembershipMeta,
    FeatureMeta,
    InheritanceMeta,
    MembershipMeta,
    RelationshipMeta,
    TypeMeta,
} from "./_internal";
import { enumerable } from "../../utils";

export const ImplicitConnectors = {
    base: "Links::links",
    binary: "Links::binaryLinks",
    object: "Objects::linkObjects",
    binaryObject: "Objects::binaryLinkObjects",
};

@metamodelOf(Connector, ImplicitConnectors)
export class ConnectorMeta extends Mixin(ConnectorMixin, RelationshipMeta, FeatureMeta) {
    private _ends: EndFeatureMembershipMeta[] = [];

    @enumerable
    public get ends(): EndFeatureMembershipMeta[] {
        return this._ends;
    }
    public set ends(value: EndFeatureMembershipMeta[]) {
        this._ends = value;
    }

    override defaultSupertype(): string {
        if (this.hasStructureType()) {
            if (this._ends.length > 2) return "object";
            return this.isBinary() ? "binaryObject" : "object";
        }

        if (this._ends.length > 2) return "base";
        return this.isBinary() ? "binary" : "base";
    }

    override ast(): Connector | undefined {
        return this._ast as Connector;
    }

    protected override onSpecializationAdded(specialization: InheritanceMeta): void {
        this.resetEnds();
        FeatureMeta.prototype["onSpecializationAdded"].call(this, specialization);
    }

    override featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        return (this._ends as MembershipMeta<FeatureMeta>[]).concat(
            FeatureMeta.prototype.featureMembers.call(this)
        );
    }

    contextType(): TypeMeta | undefined {
        let commonFeaturingTypes: TypeMeta[] | undefined;
        for (const related of this.relatedFeatures()) {
            const featurings = related.allFeaturingTypes();
            if (!commonFeaturingTypes) {
                commonFeaturingTypes = featurings;
                continue;
            }

            commonFeaturingTypes = commonFeaturingTypes
                .map((type) => {
                    const subtype = featurings.find((t) => t.conforms(type));
                    // replace with a subtype if one exists
                    if (subtype) return subtype;
                    // remove if there are no common types
                    if (featurings.every((t) => !type.conforms(t))) return undefined;
                    // no change
                    return type;
                })
                .filter((t) => t) as TypeMeta[];
        }

        return commonFeaturingTypes?.at(0);
    }

    /**
     * @returns end features of this connector
     */
    connectorEnds(): FeatureMeta[] {
        return this.ownedEnds();
    }

    /**
     * @returns features related by this connector
     */
    relatedFeatures(): FeatureMeta[] {
        // related features are the reference subsettings of the connector ends
        // by the spec, there shouldn't be more than 1 reference subsetting
        return stream(this.allEnds())
            .map((end) => end.specializations(ReferenceSubsetting).at(0))
            .map((sub) => sub?.element())
            .nonNullable()
            .toArray() as FeatureMeta[];
    }

    override textualParts(): ElementParts {
        const parts: ElementParts = {
            prefixes: this.prefixes,
        };

        if (this._multiplicity) {
            parts.multiplicity = [this._multiplicity];
        }
        parts.heritage = this.heritage;
        parts.typeRelationships = this.typeRelationships;

        if (this.value) {
            parts.value = [this.value];
        }

        parts.ends = this.ends;
        parts.children = this.children;

        return parts;
    }
}

declare module "../../generated/ast" {
    interface Connector {
        $meta: ConnectorMeta;
    }
}
