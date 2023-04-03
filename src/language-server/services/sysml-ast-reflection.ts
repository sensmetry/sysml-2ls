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

import { AstNode, CstNode, Mutable, stream, TypeMetaData } from "langium";
import * as ast from "../generated/ast";
import { typeIndex } from "../model/types";
import { AstContainer, AstParent, AstPropertiesFor } from "../utils/ast-util";
import { SysMLReferenceInfo } from "./references/linker";

export type SysMLType = {
    [K in keyof ast.SysMlAstType]: ast.SysMlAstType[K] extends string ? never : K;
}[keyof ast.SysMlAstType];
export type SysMLTypeList = { [K in SysMLType]: ast.SysMlAstType[K] };
export type SysMLInterface<K extends SysMLType> = SysMLTypeList[K];

export class SysMLAstReflection extends ast.SysMlAstReflection {
    protected readonly metadata = new Map<string, TypeMetaData>();

    override getReferenceType(refInfo: SysMLReferenceInfo): string {
        // references are split by scope and chain tokens and stored in the same
        // array so have to programmatically determine reference types

        const container = refInfo.container;

        if (refInfo.index === container.parts.length - 1) {
            // last element
            switch (container.$type) {
                case ast.TypeReference:
                    return ast.Type;
                case ast.ClassifierReference:
                    return ast.Classifier;
                case ast.MetaclassReference:
                    return ast.Metaclass;
                case ast.MembershipReference:
                    return ast.Membership;
                case ast.NamespaceReference:
                    return ast.Namespace;
                case ast.FeatureReference:
                    return ast.Feature;
                case ast.ConjugatedPortReference:
                    return ast.ConjugatedPortDefinition;
            }
        }

        return ast.Element;
    }

    override isSubtype(subtype: string, supertype: string): boolean {
        return typeIndex.isSubtype(subtype, supertype);
    }

    override getTypeMetaData(type: string): TypeMetaData {
        let meta = this.metadata.get(type);
        if (meta) return meta;

        // using map since there are a lot of duplicated properties
        const properties = new Map(
            super.getTypeMetaData(type).mandatory.map((p) => [p.name, p.type])
        );

        // the default langium implementation doesn't care about hierarchy
        // members resulting in some arrays/booleans being left undefined... fix
        // that here
        for (const base of typeIndex.getInheritanceChain(type)) {
            const baseMeta = super.getTypeMetaData(base);
            for (const { name, type } of baseMeta.mandatory) {
                if (properties.has(name)) continue;
                properties.set(name, type);
            }
        }

        meta = {
            name: type,
            mandatory: stream(properties.entries())
                .map(([name, type]) => {
                    return { name, type };
                })
                .toArray(),
        };

        // also make sure all nodes have $children member
        meta.mandatory.push({ name: "$children", type: "array" });
        this.metadata.set(type, meta);
        return meta;
    }

    private assignMandatoryProperties(obj: { $type: string }): void {
        const typeMetaData = this.getTypeMetaData(obj.$type);
        const out = obj as Record<string, unknown>;
        for (const mandatoryProperty of typeMetaData.mandatory) {
            const value = out[mandatoryProperty.name];
            if (mandatoryProperty.type === "array" && !Array.isArray(value)) {
                out[mandatoryProperty.name] = [];
            } else if (mandatoryProperty.type === "boolean" && value === undefined) {
                out[mandatoryProperty.name] = false;
            }
        }

        if (out["$childIndex"] === undefined) out["$childIndex"] = 0;
    }

    /**
     * Programmatically create an AST node with a given {@link type}
     * @param type AST node type
     * @param values AST node values
     * @returns Constructed AST node
     */
    createNode<
        V extends SysMLType,
        T extends AstParent<SysMLInterface<V>>,
        P extends AstPropertiesFor<SysMLInterface<V>, T>
    >(type: V, values: ConstructParams<SysMLInterface<V>, T, P>): SysMLInterface<V> {
        const partialNode = { $type: type, ...values };

        // if there's a CST node, modify it to point to the created node
        if (values.$cstNode) {
            const cstNode = shallowClone(values.$cstNode);
            (cstNode as Mutable<CstNode>).element = partialNode as AstNode;
            (partialNode as Mutable<AstNode>).$cstNode = cstNode;
            (cstNode as AutoCstNode).$implicit = true;
        }
        this.assignMandatoryProperties(partialNode);
        return this.assignNode(partialNode as unknown as SysMLInterface<V>, values);
    }

    /**
     * Assign {@link child} to a parent AST node with {@link info}
     * @param child Child AST node
     * @param info Properties defining {@link child} parent and its relationship
     * @returns child
     */
    assignNode<V extends AstNode, T extends AstParent<V>, P extends AstPropertiesFor<V, T>>(
        child: V,
        info: AstContainer<V, T, P>
    ): V {
        const parent = info.$container;
        const property = info.$containerProperty;
        if (!parent || !property) return child;
        const member = (parent as NonNullable<T>)[property];
        const index = info.$containerIndex;
        if (Array.isArray(member)) {
            if (index !== undefined) {
                member.forEach((v, i) => {
                    if (i >= index) (v as Mutable<AstNode>).$containerIndex = i + 1;
                });
                member.splice(index, 0, child);
                (child as Mutable<AstNode>).$containerIndex = index;
            } else {
                member.push(child);
                (child as Mutable<AstNode>).$containerIndex = member.length - 1;
            }
        } else {
            if (index !== undefined)
                throw new Error("Cannot assign with an index to a non-array property");
            (parent as unknown as Record<string, V>)[property as string] = child;
        }

        (child as Mutable<AstNode>).$container = parent;
        (child as Mutable<AstNode>).$containerProperty = property as string;

        // if this was called during parsing, it may be possible that $children
        // has not been created yet
        if (parent.$children) {
            const cst = child.$cstNode;
            if (cst) {
                const index = parent.$children.findIndex((node) => {
                    if (!node.$cstNode) return;
                    return node.$cstNode.offset > cst.end;
                });
                if (index >= 0) {
                    parent.$children
                        .slice(index)
                        .forEach((node) => (node as Mutable<AstNode>).$childIndex++);
                    parent.$children.splice(index, 0, child);
                }
            }
            parent.$children.push(child);
            (child as Mutable<AstNode>).$childIndex = parent.$children.length - 1;
        }
        return child;
    }
}

export type ConstructParams<
    V extends AstNode,
    T extends AstParent<V>,
    P extends AstPropertiesFor<V, T>
> = Omit<Partial<V>, "$type" | "$container" | "$containerProperty" | "$containerIndex"> &
    AstContainer<V, T, P>;

// https://stackoverflow.com/a/43533066/20107711
function shallowClone<T>(obj: T): T {
    return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
}

interface AutoCstNode extends CstNode {
    $implicit: true;
}

export function isProgrammaticNode(node: AstNode): boolean {
    return !node.$cstNode || "$implicit" in node.$cstNode;
}
