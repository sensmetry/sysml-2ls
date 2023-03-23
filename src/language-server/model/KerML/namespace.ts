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
    AnnotatingElement,
    Comment,
    Documentation,
    MetadataFeature,
    Namespace,
} from "../../generated/ast";
import { BuildState } from "../enums";
import { ElementID, metamodelOf, ModelContainer } from "../metamodel";
import {
    CommentMeta,
    DocumentationMeta,
    ElementMeta,
    FeatureMeta,
    ImportMeta,
    MembershipMeta,
    RelationshipMeta,
} from "./_internal";

@metamodelOf(Namespace)
export class NamespaceMeta extends ElementMeta {
    /**
     * Import statements
     */
    imports: ImportMeta[] = [];

    /**
     * Alias members
     */
    aliases: MembershipMeta[] = [];

    /**
     * Imports resolution state
     */
    importResolutionState: BuildState = "none";

    constructor(elementId: ElementID, parent: ModelContainer<Namespace>) {
        super(elementId, parent);
    }

    override initialize(node: Namespace): void {
        this.imports = node.imports.map((v) => v.$meta);
        this.aliases = node.aliases.map((v) => v.$meta);
    }

    override ast(): Namespace | undefined {
        return this._ast as Namespace;
    }

    override parent(): ModelContainer<Namespace> {
        return this._parent;
    }

    override reset(node: Namespace): void {
        this.importResolutionState = "none";
        this.initialize(node);
    }

    protected override collectChildren(node: Namespace): void {
        node.annotatingMembers.forEach((a) => {
            this.members.push(a.$meta);
            if (!a.element) return;

            const element = a.element as AnnotatingElement;
            if (element.about.length > 0) return;

            const meta = element.$meta;
            if (meta.is(MetadataFeature)) this.metadata.push(meta);
            else if (element.$type === Comment) this.comments.push(meta as CommentMeta);
            else if (element.$type === Documentation) this.docs.push(meta as DocumentationMeta);
        });

        node.namespaceMembers.forEach((n) => {
            this.members.push(n.$meta);
            this.elements.push(n.$meta as MembershipMeta<NamespaceMeta>);
        });
        node.relationshipMembers.forEach((r) => {
            this.members.push(r.$meta);
            this.relationships.push(r.$meta as MembershipMeta<RelationshipMeta>);
        });
        node.members.forEach((m) => {
            this.members.push(m.$meta);
            this.features.push(m.$meta as MembershipMeta<FeatureMeta>);
        });
    }
}

declare module "../../generated/ast" {
    interface Namespace {
        $meta: NamespaceMeta;
    }
}
