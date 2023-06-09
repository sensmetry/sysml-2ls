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

import { Stream, stream } from "langium";
import {
    Comment,
    Documentation,
    Element,
    ElementFilterMembership,
    Feature,
    Import,
    Membership,
    MetadataFeature,
    Namespace,
    TextualRepresentation,
} from "../../generated/ast";
import { SubtypeKeys, SysMLInterface, SysMLTypeList } from "../../services";
import { KeysMatching, NonNullable, enumerable } from "../../utils";
import { BuildState } from "../enums";
import { metamodelOf } from "../metamodel";
import {
    CommentMeta,
    DocumentationMeta,
    ElementFilterMembershipMeta,
    ElementMeta,
    ElementParts,
    FeatureMeta,
    ImportMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    OwningMembershipMeta,
    TextualRepresentationMeta,
} from "./_internal";
import { ElementContainer } from "../containers";

const FeatureMembers = (e: ElementMeta): e is MembershipMeta<FeatureMeta> =>
    Boolean(
        // filters are feature members but not what we want, they serve a different purpose
        e.nodeType() !== ElementFilterMembership && e.is(Membership) && e.element()?.is(Feature)
    );
const Filters = ElementFilterMembership;
const Imports = Import;

const makeMemberFilter =
    <K extends SubtypeKeys<Element>>(type: K) =>
    (e: ElementMeta): e is MembershipMeta<SysMLInterface<K>["$meta"]> =>
        Boolean(e.is(Membership) && e.element()?.is(type));

const DocMembers = makeMemberFilter(Documentation);
const CommentMembers = makeMemberFilter(Comment);
const MetaMembers = makeMemberFilter(MetadataFeature);
const RepMembers = makeMemberFilter(TextualRepresentation);

@metamodelOf(Namespace)
export class NamespaceMeta extends ElementMeta {
    protected _prefixes: OwningMembershipMeta<MetadataFeatureMeta>[] = [];
    protected _children = new ElementContainer<Membership | Import>();
    private _importResolutionState: BuildState = "none";

    override get comments(): readonly CommentMeta[] {
        return this._children
            .get(CommentMembers)
            .map((m) => m.element())
            .filter(NonNullable)
            .concat(this._comments);
    }

    override get documentation(): readonly DocumentationMeta[] {
        return this._children
            .get(DocMembers)
            .map((m) => m.element())
            .filter(NonNullable)
            .concat(this._docs);
    }

    override get metadata(): Stream<MetadataFeatureMeta> {
        return stream(this._prefixes, this._children.get(MetaMembers))
            .map((m) => m.element())
            .filter(NonNullable)
            .concat(this._metadata);
    }

    override get textualRepresentation(): readonly TextualRepresentationMeta[] {
        return this._children
            .get(RepMembers)
            .map((m) => m.element())
            .filter(NonNullable)
            .concat(this._reps);
    }

    @enumerable
    get children(): readonly (MembershipMeta | ImportMeta)[] {
        return this._children.all;
    }

    protected addChild(...element: (MembershipMeta | ImportMeta)[]): this {
        this._children.add(...element);
        return this;
    }

    /**
     * Metadata prefixes of this elements
     */
    @enumerable
    get prefixes(): readonly OwningMembershipMeta<MetadataFeatureMeta>[] {
        return this._prefixes;
    }

    protected addPrefix(...prefix: OwningMembershipMeta<MetadataFeatureMeta>[]): this {
        this._prefixes.push(...prefix);
        return this;
    }

    /**
     * Import statements
     */
    get imports(): readonly ImportMeta[] {
        return this._children.get(Imports);
    }

    get filters(): readonly ElementFilterMembershipMeta[] {
        return this._children.get(Filters);
    }

    featureMembers(): readonly MembershipMeta<FeatureMeta>[] {
        return this._children.get(FeatureMembers);
    }

    /**
     * Imports resolution state
     */
    get importResolutionState(): BuildState {
        return this._importResolutionState;
    }
    set importResolutionState(value: BuildState) {
        this._importResolutionState = value;
    }

    override ast(): Namespace | undefined {
        return this._ast as Namespace;
    }

    /**
     * @returns stream of all owned and inherited features
     */
    allFeatures(): Stream<MembershipMeta<FeatureMeta>> {
        return stream(this.featureMembers());
    }

    featuresByMembership<K extends KeysMatching<SysMLTypeList, Membership>>(
        kind: K
    ): Stream<FeatureMeta> {
        return stream(this.featureMembers())
            .filter((m) => m.is(kind))
            .map((m) => m.element())
            .nonNullable();
    }

    featuresMatching<K extends KeysMatching<SysMLTypeList, Feature>>(
        kind: K
    ): Stream<SysMLTypeList[K]["$meta"]> {
        return stream(this.featureMembers())
            .map((m) => m.element())
            .nonNullable()
            .filter((f) => f.is(kind)) as Stream<SysMLTypeList[K]["$meta"]>;
    }

    protected collectParts(): ElementParts {
        return [
            ["prefixes", this.prefixes],
            ["children", this.children],
        ];
    }

    override invalidateMemberCaches(): void {
        // only members in children may have references which may invalidate
        // caches
        this._children.invalidateCaches();
    }
}

declare module "../../generated/ast" {
    interface Namespace {
        $meta: NamespaceMeta;
    }
}
