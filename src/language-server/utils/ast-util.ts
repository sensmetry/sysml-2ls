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

import { AstNode, CstNode, TreeStream, TreeStreamImpl } from "langium";
import { Position, Range } from "vscode-languageserver";
import { Alias, isAlias } from "../generated/ast";
import { AliasMeta, ElementMeta, Metamodel } from "../model";
import { AssignableKeys } from "./common";

/**
 * Create a stream of all AST nodes that are directly and indirectly contained
 * in the given root node. This does not include the root node itself.
 */
export function streamAllContents(root: AstNode): TreeStream<AstNode> {
    return new TreeStreamImpl(root, (node) => node.$children);
}

/**
 * Create a stream of all AST nodes that are directly and indirectly contained
 * in the given root node, including the root node itself.
 */
export function streamAst(root: AstNode): TreeStream<AstNode> {
    return new TreeStreamImpl(root, (node) => node.$children, { includeRoot: true });
}

/**
 * AST node container type
 */
export type AstParent<T extends AstNode> = T["$container"];

/**
 * Keys of potentially AstNode {@link T} that match either {@link V}? or {@link Array}<{@link V}>
 */
export type AstKeysFor<T, V> = AssignableKeys<T, V | undefined> | AssignableKeys<T, Array<V>>;

/**
 * Keys that can be used to assign AST node {@link V} to a parent AST node {@link T}
 */
export type AstPropertiesFor<V extends AstNode, T extends AstParent<V>> = AstKeysFor<T, V>;

export type AstContainer<
    V extends AstNode,
    T extends AstParent<V>,
    P extends AstPropertiesFor<V, T>
> = {
    /**
     * The container node in the AST; every node except the root node has a
     * container.
     */
    $container: T;
    /**
     * The property of the `$container` node that contains this node. This is
     * either a direct reference or an array.
     */
    $containerProperty?: P;
    /**
     * In case {@link $containerProperty} is an array, the array index is stored here.
     */
    $containerIndex?: T[P] extends Array<unknown> ? number : never;
};

const EMPTY_POS: Position = { line: 0, character: 0 };

/**
 * Compare range start positions for use in sorting
 * @param lhs first range to compare
 * @param rhs second range to compare
 * @returns value which can be used for sorting ranges in ascending order by
 * their start positions, negate the returned value for descending sorting
 */
export function compareRanges(lhs?: Range, rhs?: Range): number {
    const left = lhs?.start ?? EMPTY_POS;
    const right = rhs?.start ?? EMPTY_POS;

    const lineDiff = left.line - right.line;
    if (lineDiff !== 0) return lineDiff;
    return left.character - right.character;
}

/**
 * @returns number of lines between the end of `a` and `b`
 */
export function linesDiff(a: CstNode, b: CstNode): number {
    return b.range.start.line - a.range.end.line;
}

/**
 * Follow through alias to get a node matching `fn` predicate
 * @param node Alias or AstNode
 * @param fn type predicate
 * @returns node for which `fn` returns true or undefined otherwise
 */
export function resolveAlias<T extends AstNode>(
    node: AstNode,
    fn: (n: unknown) => n is T
): T | undefined {
    const target = followAstAlias(node);
    return fn(target) ? target : undefined;
}

/**
 * Same as `resolveAlias` but without type checking
 * @param node
 * @returns
 */
export function followAstAlias(node: AstNode | undefined): AstNode | undefined {
    if (isAlias(node)) {
        return node.$meta.for.target?.element.self();
    }
    return node;
}

export function followAlias(node: AliasMeta | undefined): ElementMeta | undefined;
export function followAlias(node: ElementMeta | undefined): ElementMeta | undefined;
export function followAlias(node: Metamodel | undefined): Metamodel | undefined;

/**
 * Same as `resolveAlias` but without type checking
 * @param node
 * @returns
 */
export function followAlias(node: Metamodel | undefined): Metamodel | undefined {
    if (node?.is(Alias)) {
        return node.for.target?.element;
    }
    return node;
}
