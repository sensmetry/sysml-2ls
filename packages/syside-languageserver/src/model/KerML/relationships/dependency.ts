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

import { AstNode, LangiumDocument, Stream, stream } from "langium";
import { Dependency } from "../../../generated/ast";
import { NonNullable, enumerable } from "../../../utils";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import {
    AnnotationMeta,
    Edge,
    ElementMeta,
    ElementOptions,
    ElementParts,
    MetadataFeatureMeta,
    RelationshipMeta,
} from "../_internal";

export interface DependencyOptions extends ElementOptions<RelationshipMeta> {
    /**
     * Should be at least length 1
     */
    client: ElementMeta[];

    /**
     * Should be at least length 1
     */
    supplier: ElementMeta[];

    prefixes?: readonly Edge<AnnotationMeta, MetadataFeatureMeta>[];
}

@metamodelOf(Dependency)
// @ts-expect-error ignore static inheritance warning why is it even a thing???
export class DependencyMeta extends RelationshipMeta {
    protected _prefixes: AnnotationMeta<MetadataFeatureMeta>[] = [];
    private _client: ElementMeta[] = [];
    private _supplier: ElementMeta[] = [];

    override get metadata(): Stream<MetadataFeatureMeta> {
        return stream(this._prefixes)
            .map((m) => m.element())
            .filter(NonNullable)
            .concat(super.metadata);
    }

    /**
     * Metadata prefixes of this elements
     */
    @enumerable
    get prefixes(): readonly AnnotationMeta<MetadataFeatureMeta>[] {
        return this._prefixes;
    }

    /**
     * Adds new owned metadata prefixes and return the new number of prefixes.
     * Note that the annotations take ownership of the metadata.
     */
    addPrefix(...prefix: Edge<AnnotationMeta, MetadataFeatureMeta>[]): number {
        return this.addOwnedElements(
            this._prefixes,
            prefix.map(([edge, target]) => {
                // different from all the other relationships that the owned
                // element is the source, also these annotations own their
                // sources
                edge["setSource"](target);
                edge["takeOwnership"](target);
                return edge;
            })
        );
    }

    /**
     * Removes metadata prefixes by their annotations and returns the new number
     * of prefixes.
     */
    removePrefix(...prefix: AnnotationMeta[]): number {
        return this.removeOwnedElements(this._prefixes, prefix, (annotation) => {
            // break ownership of the metadata
            const target = annotation.source();
            if (target) annotation["unsetOwnership"](target);
        });
    }

    /**
     * Removes metadata prefixes by a predicate and returns the new number of
     * prefixes.
     * @see {@link removePrefix}
     */
    removePrefixIf(predicate: (element: AnnotationMeta<MetadataFeatureMeta>) => boolean): number {
        return this.removeOwnedElementsIf(this._prefixes, predicate);
    }

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

    @enumerable
    get client(): ElementMeta[] {
        return this._client;
    }

    override source(): ElementMeta | undefined {
        return this._client.at(0);
    }

    @enumerable
    get supplier(): ElementMeta[] {
        return this._supplier;
    }

    override element(): ElementMeta | undefined {
        return this._supplier.at(0);
    }

    override ast(): Dependency | undefined {
        return this._ast as Dependency;
    }

    protected override collectParts(): ElementParts {
        return [
            ["prefixes", this.prefixes],
            ["children", this.children],
        ];
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: DependencyOptions
    ): T["$meta"] {
        const model = ElementMeta.create.call(this, provider, document, options) as DependencyMeta;
        if (options) {
            model._client.push(...options.client);
            model._supplier.push(...options.supplier);
            if (options.prefixes) model.addPrefix(...options.prefixes);
        }
        return model;
    }
}

declare module "../../../generated/ast" {
    interface Dependency {
        $meta: DependencyMeta;
    }
}
