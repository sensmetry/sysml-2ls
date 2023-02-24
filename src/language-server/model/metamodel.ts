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

import { AstNode } from "langium";
import { typeIndex, TypeMap } from "./types";
import { BuildState, SpecializationKind } from "./enums";
import { SysMLType, SysMLTypeList } from "../services/sysml-ast-reflection";

// Additional metadata stored with the AST nodes from postprocessing steps N.B.
// all AST nodes here are references

export type ElementID = number;

// Mapping of implicit generalizations
type ImplicitGeneralizations = {
    [key: string]: string;
};

type Property<T extends object | undefined, K extends keyof NonNullable<T>> = undefined extends T
    ? NonNullable<T>[K] | undefined
    : NonNullable<T>[K];

// cannot use $meta since base classes may have subclasses as their owners
// leading to circular dependencies
type Meta<T extends AstNode> = Metamodel<T>;
type Container<T extends AstNode> = T["$container"];

export type ModelContainer<T extends AstNode> = undefined extends Container<T>
    ? Meta<NonNullable<Container<T>>> | undefined
    : Meta<NonNullable<Container<T>>>;

export type ParentModel<T extends AstNode> = Property<Container<T>, "$meta">;

export type MetaCtor<T extends AstNode> = (
    id: ElementID,
    parent: ModelContainer<T>
) => BasicMetamodel<T>;

/**
 * Map of metamodel constructors
 */
export const META_FACTORY: { [K in SysMLType]?: MetaCtor<SysMLTypeList[K]> } = {};
/**
 * Map of metamodel prototypes, since TS mixins do not work the same way as
 * regular multiple inheritance (i.e. only the last inherited method of the same
 * name will be called but not both), prototypes are stored so that inherited
 * functions can be called on all base types explicitly
 */
export const META_PROTOTYPES: TypeMap<SysMLTypeList, BasicMetamodel> = {};
type MethodName = {
    // eslint-disable-next-line @typescript-eslint/ban-types
    [K in keyof BasicMetamodel]: BasicMetamodel[K] extends Function ? K : never;
}[keyof BasicMetamodel];
type AnyFunction = (...args: [unknown]) => unknown;
const META_METHODS = new Map<SysMLType, Map<MethodName, AnyFunction[]>>();

/**
 * Get metamodel methods with {@link name} for {@link type}
 * @param type AST node type that has a metamodel
 * @param name name of the metamodel method
 * @returns array of all metamodel method matching {@link name} in the order
 * from the most general type to the most derived type
 */
function getMethods(type: SysMLType, name: MethodName): AnyFunction[] {
    let methodMap = META_METHODS.get(type);
    if (!methodMap) {
        methodMap = new Map();
        META_METHODS.set(type, methodMap);
    }

    let methods = methodMap.get(name);
    if (methods) return methods;

    const protos = new Set<(...args: [unknown]) => unknown>();
    const add = (type: SysMLType): void => {
        const proto = META_PROTOTYPES[type];
        if (!proto) return;
        protos.add(proto[name] as AnyFunction);
    };

    add(type);
    for (const supertype of typeIndex.getInheritanceChain(type)) {
        add(supertype);
    }
    protos.add(BasicMetamodel.prototype[name] as AnyFunction);

    // reverse so that methods are called from the bottom up
    methods = Array.from(protos).reverse();
    methodMap.set(name, methods);
    return methods;
}

/**
 * Map of registered implicit types
 */
export const IMPLICIT_MAP: TypeMap<SysMLTypeList, [string, string][]> = {};

type Metatype<T extends AstNode> = { new (id: ElementID, parent: ModelContainer<T>): Metamodel<T> };

// seems class decorators are called during module processing so this should
// work
export function metamodelOf<K extends SysMLType>(
    type: K,
    generalizations: ImplicitGeneralizations = {}
): (target: Metatype<SysMLTypeList[K]>) => void {
    IMPLICIT_MAP[type] = Object.entries(generalizations);

    return function (target: Metatype<SysMLTypeList[K]>): void {
        // can't do module augmentation :(
        // @ts-expect-error should be caught by the function declaration
        META_FACTORY[type] = (
            id: ElementID,
            parent: ModelContainer<SysMLTypeList[K]>
        ): Metamodel<SysMLTypeList[K]> => new target(id, parent);
        META_PROTOTYPES[type] = target.prototype;

        // replace with static functions
        target.prototype.implicitGeneralizations = function (): ImplicitGeneralizations {
            return generalizations;
        };

        target.prototype.nodeType = function (): SysMLType {
            return type;
        };

        const supertypes = typeIndex.getInheritanceChain(type);
        target.prototype.is = function (t: SysMLType): boolean {
            return type === t || supertypes.has(t);
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
    self(): T | undefined;

    /**
     * Owning model
     */
    parent(): Metamodel | undefined;

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
    specializationKind(): SpecializationKind;

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
    isAny<K extends SysMLType>(type: K[]): this is SysMLTypeList[K]["$meta"];

    /**
     * Initialize this model from an AST node
     * @param node
     */
    initializeFromAst(node: T): void;

    /**
     * Reset this model to `node`
     * @param node
     */
    resetToAst(node: T): void;
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
    protected _self?: T;
    readonly elementId: ElementID;
    protected _parent: ModelContainer<T>;

    setupState: BuildState = "none";
    isStandardElement = false;

    constructor(id: ElementID, parent: ModelContainer<T>) {
        this.elementId = id;
        this._parent = parent;
    }

    /**
     * Initialize this metamodel, called only the first time after all nodes
     * have had their metamodels assigned.
     */
    initialize(node: T): void {
        this._self = node;
    }

    self(): T | undefined {
        return this.deref();
    }

    parent(): ModelContainer<T> {
        return this._parent;
    }

    nodeType(): SysMLType {
        return (this._self?.$type ?? "Unknown") as SysMLType;
    }

    implicitGeneralizations(): ImplicitGeneralizations {
        return {};
    }

    /**
     * Reset any cached values in this metamodel
     */
    reset(node: T): void {
        this._self = node;
        this.setupState = "none";
    }

    protected deref(): T | undefined {
        return this._self;
    }

    defaultGeneralTypes(): string[] {
        return [this.defaultSupertype()];
    }

    defaultSupertype(): string {
        return "base";
    }

    specializationKind(): SpecializationKind {
        return SpecializationKind.Specialization;
    }

    is<K extends SysMLType>(type: K): this is SysMLTypeList[K]["$meta"] {
        return typeIndex.isSubtype(this.nodeType(), type);
    }

    isAny<K extends SysMLType>(type: K[]): this is SysMLTypeList[K]["$meta"] {
        return type.some((t) => this.is(t));
    }

    initializeFromAst(node: T): void {
        const methods = getMethods(this.nodeType(), "initialize");
        methods.forEach((m) => m.call(this, node));
    }

    resetToAst(node: T): void {
        const methods = getMethods(this.nodeType(), "reset");
        methods.forEach((m) => m.call(this, node));
    }
}

// extend generated AST nodes with an additional $meta member
declare module "langium" {
    interface AstNode {
        $meta?: Metamodel;
    }
}
