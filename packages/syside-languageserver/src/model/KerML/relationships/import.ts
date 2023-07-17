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

import { AstNode, LangiumDocument } from "langium";
import { Import } from "../../../generated/ast";
import { enumerable } from "../../../utils";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel";
import {
    ElementMeta,
    MembershipMeta,
    NamespaceMeta,
    RelationshipMeta,
    RelationshipOptionsBody,
} from "../_internal";

export type Importable = MembershipMeta | NamespaceMeta;

export interface ImportOptions<
    T extends Importable = Importable,
    P extends NamespaceMeta = NamespaceMeta,
> extends RelationshipOptionsBody<T, P> {
    isRecursive?: boolean;
    importsAll?: boolean;
}

@metamodelOf(Import, "abstract")
// @ts-expect-error ignoring static inheritance error
export abstract class ImportMeta<T extends Importable = Importable> extends RelationshipMeta<T> {
    isRecursive = false;

    /**
     * Whether visibility is ignored
     */
    protected _importsAll = false;

    @enumerable
    get importsAll(): boolean {
        return this._importsAll;
    }
    set importsAll(value) {
        this._importsAll = value;
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

    override ast(): Import | undefined {
        return this._ast as Import;
    }

    /**
     *
     * @returns true if this import only imports a single name into a scope,
     * false otherwise
     */
    importsNameOnly(): boolean {
        return false;
    }

    protected static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ImportOptions
    ): T["$meta"] {
        const imp = super.create(provider, document, options) as ImportMeta;
        imp.isRecursive = Boolean(options?.isRecursive);
        imp._importsAll = Boolean(options?.importsAll);
        return imp;
    }
}

declare module "../../../generated/ast" {
    interface Import {
        $meta: ImportMeta;
    }
}
