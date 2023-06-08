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

/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { AstNode, CstNode } from "langium";
import { typeIndex, TypeMap } from "./types";
import { BuildState } from "./enums";
import { SysMLType, SysMLTypeList } from "../services/sysml-ast-reflection";
import { NonOwnerType, Specialization } from "../generated/ast";
import type { ElementMeta } from "./KerML";
import { settings } from "ts-mixer";

settings.initFunction = "init";

// Additional metadata stored with the AST nodes from postprocessing steps N.B.
// all AST nodes here are references

export type ElementID = number;

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

export type MetaCtor<T extends AstNode> = (id: ElementID) => BasicMetamodel<T>;

/**
 * Map of metamodel constructors
 */
export const META_FACTORY: { [K in SysMLType]?: MetaCtor<SysMLTypeList[K]> } = {};

/**
 * Map of registered implicit types
 */
export const IMPLICIT_MAP: TypeMap<SysMLTypeList, [string, string][]> = {};

type Metatype<T extends AstNode> = new (id: ElementID) => Metamodel<T>;
type AbstractMetatype<T extends AstNode> = abstract new (id: ElementID) => Metamodel<T>;

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
            (id: ElementID): Metamodel<SysMLTypeList[K]> => new target(id);

        target.prototype.implicitGeneralizations = function (): ImplicitGeneralizations {
            return generalizations;
        };
    };
}

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
    defaultGeneralTypes(): string[];

    /**
     * Default general type kind that should be directly or indirectly
     * specialized, {@link defaultGeneralTypes defaultGeneralTypes}
     */
    defaultSupertype(): string;

    /**
     * Default specialization kind for implicit general types
     */
    specializationKind(): SysMLType;

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
        typeof (o as Record<string, unknown>)["isStandardElement"] === "boolean"
    );
}

export class BasicMetamodel<T extends AstNode = AstNode> implements Metamodel<T> {
    protected _ast?: T;
    readonly elementId: ElementID;
    protected _parent: Metamodel | undefined;
    protected _owner: Metamodel | undefined;

    setupState: BuildState = "none";
    isStandardElement = false;

    constructor(id: ElementID) {
        this.elementId = id;
    }

    protected takeOwnership(element: BasicMetamodel): void {
        element.setParent(this);
    }

    protected setParent(parent: Metamodel | undefined): void {
        const previous = this._parent;
        this._parent = parent;
        if (parent) this._owner = parent.is(NonOwnerType) ? parent.parent() : parent;
        else this._owner = undefined;

        this.onParentSet(previous as ElementMeta, parent as ElementMeta);
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

    defaultGeneralTypes(): string[] {
        return [this.defaultSupertype()];
    }

    defaultSupertype(): string {
        return "base";
    }

    specializationKind(): SysMLType {
        return Specialization;
    }

    is<K extends SysMLType>(type: K): this is SysMLTypeList[K]["$meta"] {
        return typeIndex.isSubtype(this.nodeType(), type);
    }

    isAny<K extends SysMLType>(...type: K[]): this is SysMLTypeList[K]["$meta"] {
        return type.some((t) => this.is(t));
    }
}

// extend generated AST nodes with an additional $meta member
declare module "langium" {
    interface AstNode {
        $meta?: BasicMetamodel;
    }
}
