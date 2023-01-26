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

import { SysMlAstType } from "../generated/ast";
import { AstNode } from "langium";
import { typeIndex, TypeMap } from "./types";
import { BuildState, SpecializationKind } from "./enums";
import { SysMLType } from "../services/sysml-ast-reflection";

// Additional metadata stored with the AST nodes from postprocessing steps N.B.
// all AST nodes here are references

export type ElementID = number;

// Mapping of implicit generalizations
type ImplicitGeneralizations = {
    [key: string]: string;
};

/**
 * Map of metamodel constructors
 */
export const META_FACTORY: TypeMap<SysMlAstType, (node: AstNode, id: ElementID) => Metamodel> = {
    default: (node, id) => new BasicMetamodel(node, id),
};
/**
 * Map of metamodel prototypes, since TS mixins do not work the same way as
 * regular multiple inheritance (i.e. only the last inherited method of the same
 * name will be called but not both), prototypes are stored so that inherited
 * functions can be called on all base types explicitly
 */
export const META_PROTOTYPES: TypeMap<SysMlAstType, Metamodel> = {};
type MethodName = {
    // eslint-disable-next-line @typescript-eslint/ban-types
    [K in keyof Metamodel]: Metamodel[K] extends Function ? K : never;
}[keyof Metamodel];
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

    // reverse so that methods are called from the bottom up
    methods = Array.from(protos).reverse();
    methodMap.set(name, methods);
    return methods;
}

/**
 * Call all metamodel methods {@link name} in the inheritance order explicitly
 * @param meta metamodel instance
 * @param name method name
 * @param args parameters to pass to methods with {@link name}
 * @returns the return value of the last method, i.e. `meta[name](...args)`
 */
export function callAll<M extends Metamodel, K extends MethodName = MethodName>(
    meta: M,
    name: K,
    ...args: Parameters<M[K]>
): ReturnType<M[K]> {
    const methods = getMethods(meta.nodeType(), name);
    const size = methods.length;

    if (size === 0) return BasicMetamodel.prototype[name].call(meta, ...(args as [unknown]));

    for (let i = 0; i < size - 1; i++) {
        methods[i].call(meta, ...(args as [unknown]));
    }

    return methods[size - 1].call(meta, ...(args as [unknown])) as ReturnType<M[K]>;
}

/**
 * Map of registered implicit types
 */
export const IMPLICIT_MAP: TypeMap<SysMlAstType, [string, string][]> = {};

type Metatype<T extends AstNode> = { new (node: T, id: ElementID): Metamodel };

// seems class decorators are called during module processing so this should
// work
export function metamodelOf(
    type: keyof SysMlAstType,
    generalizations: ImplicitGeneralizations = {}
): <T extends AstNode>(target: Metatype<T>) => void {
    IMPLICIT_MAP[type] = Object.entries(generalizations);

    return function <T extends AstNode>(target: Metatype<T>): void {
        // can't do module augmentation :(
        META_FACTORY[type] = (node: AstNode, id: ElementID): Metamodel => new target(node as T, id);
        META_PROTOTYPES[type] = target.prototype;

        // replace with static functions
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
    self(): T;

    /**
     * Owning AST node
     */
    parent(): T["$container"];

    /**
     * AST node type
     */
    nodeType(): SysMLType;

    /**
     * Map of implicit generalizations
     */
    implicitGeneralizations(): ImplicitGeneralizations;

    /**
     * Initialize this metamodel, called only the first time after all nodes
     * have had their metamodels assigned. Called through MetamodelBuilder which
     * correctly resolves mixins
     */
    initialize(node: T): void;

    /**
     * Reset any cached values in this metamodel
     */
    reset(): void;

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
}

export class BasicMetamodel<T extends AstNode> implements Metamodel<T> {
    protected _self: T;
    setupState: BuildState = "none";
    readonly elementId: ElementID;
    isStandardElement = false;

    constructor(node: T, id: ElementID) {
        this._self = node;
        this.elementId = id;
    }

    initialize(node: T): void {
        return;
    }

    self(): T {
        return this.deref();
    }

    parent(): T["$container"] {
        return this.deref().$container;
    }

    nodeType(): SysMLType {
        return this.deref().$type as SysMLType;
    }

    implicitGeneralizations(): ImplicitGeneralizations {
        return {};
    }

    reset(): void {
        this.setupState = "none";
    }

    protected deref(): T {
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
}

// extend generated AST nodes with an additional $meta member
declare module "langium" {
    interface AstNode {
        $meta?: Metamodel;
        readonly $children: AstNode[];
    }
}
