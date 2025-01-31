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

/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { AstNode, CstNode, LangiumDocument } from "langium";
import { typeIndex, TypeMap } from "./types";
import { BuildState } from "./enums";
import { SubtypeKeys, SysMLType, SysMLTypeList } from "../services/sysml-ast-reflection";
import { Inheritance, NonOwnerType, Specialization } from "../generated/ast";
import type { ElementMeta } from "./KerML";
import * as mixer from "ts-mixer";
import { Class } from "ts-mixer/dist/types/types";
import { TextComment } from "../utils";

export type ElementID = number;
export type ElementIDProvider = () => ElementID;

export type MetatypeProto<T extends AstNode = AstNode> = {
    prototype: BasicMetamodel & Metamodel<T>;
};

export type Metatype<T extends AstNode = AstNode> = MetatypeProto<T> & {
    create(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument
    ): Metamodel<T>;
};
export type AbstractMetatype<T extends AstNode = AstNode> = MetatypeProto<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mix(...types: MetatypeProto[]): (decoratedClass: any) => any {
    return mixer.mix(...(types as unknown as Class[]));
}

// Mapping of implicit generalizations
type ImplicitGeneralizations = {
    [key: string]: string;
};

export type Property<T extends object | undefined, K extends keyof NonNullable<T>> =
    | NonNullable<T>[K]
    | (undefined extends T ? undefined : never);

// cannot use $meta since base classes may have subclasses as their owners
// leading to circular dependencies
type Meta<T extends AstNode> = Metamodel<T>;
type Container<T extends AstNode> = T["$container"];

// namespaces are entry types but Langium doesn't generate optional `$container` yet
// TODO: add `| (Namespace extends T ? undefined : never)`
export type ModelContainer<T extends AstNode> =
    | Meta<NonNullable<Container<T>>>
    | (undefined extends Container<T> ? undefined : never);

export type ParentModel<T extends AstNode> = Property<Container<T>, "$meta">;

export type MetaCtor<T extends AstNode> = (
    provider: ElementIDProvider,
    document: LangiumDocument
) => BasicMetamodel<T>;

/**
 * Map of metamodel constructors
 */
export const META_FACTORY: { [K in SysMLType]?: MetaCtor<SysMLTypeList[K]> } = {};

/**
 * Map of registered implicit types
 */
export const IMPLICIT_MAP: TypeMap<SysMLTypeList, [string, string][]> = {};

export function metamodelOf<K extends SysMLType>(
    type: K,
    generalizations?: ImplicitGeneralizations
): (target: Metatype<SysMLTypeList[K]>) => void;
export function metamodelOf<K extends SysMLType>(
    type: K,
    abstract: "abstract"
): (target: AbstractMetatype<SysMLTypeList[K]>) => void;

// seems class decorators are called during module processing so this should
// work
export function metamodelOf<K extends SysMLType>(
    type: K,
    generalizations: "abstract" | ImplicitGeneralizations = {}
): (target: Metatype<SysMLTypeList[K]>) => void {
    const collect = (target: Metatype<SysMLTypeList[K]>): void => {
        target.prototype.nodeType = function (): SysMLType {
            return type;
        };

        const supertypes = new Set(typeIndex.getInheritanceChain(type));
        supertypes.add(type);
        target.prototype.is =
            supertypes.size > 1
                ? function (t: SysMLType): boolean {
                      return supertypes.has(t);
                  }
                : function (t: SysMLType): boolean {
                      return type === t;
                  };
    };

    if (generalizations === "abstract") {
        return collect;
    }

    IMPLICIT_MAP[type] = Object.entries(generalizations);

    return function (target: Metatype<SysMLTypeList[K]>): void {
        collect(target);
        // @ts-expect-error should be caught by the function declaration
        META_FACTORY[type] = //
            (provider: ElementIDProvider, document: LangiumDocument): Metamodel<SysMLTypeList[K]> =>
                target.create(provider, document);

        target.prototype.implicitGeneralizations = function (): ImplicitGeneralizations {
            return generalizations;
        };
    };
}

export type GeneralType =
    | string
    | {
          type: string;
          specialization: SubtypeKeys<Inheritance>;
      };

export interface Metamodel<T extends AstNode = AstNode> {
    /**
     * Assigned element ID
     */
    readonly elementId: ElementID;

    /**
     * Metamodel build state
     */
    setupState: BuildState;

    /**
     * Whether this element has a standard library package as its parent
     */
    isStandardElement: boolean;

    /**
     * Document that owns this model element
     */
    document: LangiumDocument;

    /**
     * Notes attached to this element
     */
    notes: TextComment[];

    /**
     * AST node associated with this metamodel
     */
    ast(): T | undefined;

    /**
     * CST node this element was parsed from
     */
    cst(): CstNode | undefined;

    /**
     * Directly owning model
     */
    parent(): Metamodel | undefined;

    /**
     * The owning element with relationships unwrapped
     */
    owner(): Metamodel | undefined;

    /**
     * AST node type
     */
    nodeType(): SysMLType;

    /**
     * Map of implicit generalizations
     */
    implicitGeneralizations(): ImplicitGeneralizations;

    /**
     * Array of strings of default general type kinds that are later resolved to
     * library elements together with the element type
     */
    defaultGeneralTypes(): GeneralType[];

    /**
     * Default general type kind that should be directly or indirectly
     * specialized, {@link defaultGeneralTypes defaultGeneralTypes}
     */
    defaultSupertype(): string;

    /**
     * Default specialization kind for implicit general types
     */
    specializationKind(): SubtypeKeys<Inheritance>;

    /**
     * Model type assertion
     * @param type AST type name this model may be for
     */
    is<K extends SysMLType>(type: K): this is SysMLTypeList[K]["$meta"];

    /**
     * @see {@link is}
     * @param type types this model may be for
     * @returns true if any types match
     */
    isAny<K extends SysMLType>(...type: K[]): this is SysMLTypeList[K]["$meta"];
}

export function isMetamodel(o: unknown): o is Metamodel {
    return (
        typeof o === "object" &&
        o !== null &&
        typeof (o as Record<string, unknown>)["elementId"] === "number" &&
        typeof (o as Record<string, unknown>)["document"] === "object" &&
        typeof (o as Record<string, unknown>)["isStandardElement"] === "boolean"
    );
}

export interface ModelElementOptions<P extends ElementMeta | undefined = ElementMeta> {
    parent?: P;
}

export class BasicMetamodel<T extends AstNode = AstNode> implements Metamodel<T> {
    protected _ast?: T;
    readonly elementId: ElementID;
    protected _parent: Metamodel | undefined;
    protected _owner: Metamodel | undefined;
    protected _document: LangiumDocument;

    setupState: BuildState = "none";
    isStandardElement = false;
    notes: TextComment[] = [];

    protected constructor(id: ElementID, document: LangiumDocument) {
        this.elementId = id;
        this._document = document;
    }

    get document(): LangiumDocument {
        return this._document;
    }

    set document(value) {
        this._document = value;
    }

    protected swapOwnership<T extends BasicMetamodel | undefined>(
        current: BasicMetamodel | undefined,
        value: T
    ): T {
        if (current) current.setParent(undefined);
        if (value) this.takeOwnership(value);
        return value;
    }

    protected takeOwnership(element: BasicMetamodel): void {
        element.setParent(this);
    }

    protected unsetOwnership(element: BasicMetamodel): void {
        element.setParent(undefined);
    }

    /**
     * @param previous if set, a tuple of previous `[parent, owner]`
     * @param current if set, a tuple of current `[parent, owner]`
     */
    protected onOwnerSet(
        previous: [ElementMeta, ElementMeta] | undefined,
        current: [ElementMeta, ElementMeta] | undefined
    ): void {
        // empty
    }

    protected setParent(parent: Metamodel | undefined): void {
        const previous = this._parent;
        this._parent = parent;
        if (previous !== parent) this.onParentSet(previous as ElementMeta, parent as ElementMeta);

        this.setOwner(parent?.is(NonOwnerType) ? parent.parent() : parent, previous);
    }

    protected setOwner(owner: Metamodel | undefined, previousParent?: Metamodel): void {
        const previousOwner = this._owner;
        this._owner = owner;

        if (previousOwner !== owner)
            this.onOwnerSet(
                previousOwner
                    ? [
                          (previousParent ?? this._parent) as ElementMeta,
                          previousOwner as ElementMeta,
                      ]
                    : undefined,
                owner ? [this._parent as ElementMeta, owner as ElementMeta] : undefined
            );
    }

    protected onParentSet(
        previous: ElementMeta | undefined,
        current: ElementMeta | undefined
    ): void {
        // empty
    }

    cst(): CstNode | undefined {
        return this._ast?.$cstNode;
    }

    ast(): T | undefined {
        return this._ast;
    }

    parent(): Metamodel | undefined {
        return this._parent;
    }

    owner(): Metamodel | undefined {
        return this._owner;
    }

    nodeType(): SysMLType {
        return (this._ast?.$type ?? "Unknown") as SysMLType;
    }

    implicitGeneralizations(): ImplicitGeneralizations {
        return {};
    }

    defaultGeneralTypes(): GeneralType[] {
        return [this.defaultSupertype()];
    }

    defaultSupertype(): string {
        return "base";
    }

    specializationKind(): Inheritance["$type"] {
        return Specialization;
    }

    is<K extends SysMLType>(type: K): this is SysMLTypeList[K]["$meta"] {
        return typeIndex.isSubtype(this.nodeType(), type);
    }

    isAny<K extends SysMLType>(...type: K[]): this is SysMLTypeList[K]["$meta"] {
        return type.some((t) => this.is(t));
    }

    static is<K extends SysMLType>(
        type: K
    ): (value?: Metamodel) => value is SysMLTypeList[K]["$meta"] {
        return (value): value is SysMLTypeList[K]["$meta"] => Boolean(value?.is(type));
    }

    static isAny<K extends SysMLType>(
        ...type: K[]
    ): (value?: Metamodel) => value is SysMLTypeList[K]["$meta"] {
        return (value): value is SysMLTypeList[K]["$meta"] => Boolean(value?.isAny(...type));
    }

    /**
     * Construct a new model element
     * @param id
     * @returns
     */
    protected static create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: ModelElementOptions
    ): T["$meta"] {
        const model = new (this as typeof BasicMetamodel)(provider(), document);
        if (options?.parent) model.setParent(options.parent);
        return model;
    }
}

export function basicIdProvider(): ElementIDProvider {
    let count = 0;
    // sequential IDs are simple and fast but may not be best if used as
    // hash keys
    return () => count++;
}

// extend generated AST nodes with an additional $meta member
declare module "langium" {
    interface AstNode {
        $meta?: BasicMetamodel;
    }
}
