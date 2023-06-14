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

    protected addPrefix(...prefix: AnnotationMeta<MetadataFeatureMeta>[]): this {
        this._prefixes.push(...prefix);
        return this;
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
        }
        return model;
    }
}

declare module "../../../generated/ast" {
    interface Dependency {
        $meta: DependencyMeta;
    }
}
