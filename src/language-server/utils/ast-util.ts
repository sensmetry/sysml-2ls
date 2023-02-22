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
    AstNode,
    CstNode,
    EMPTY_STREAM,
    isAstNode,
    Stream,
    TreeStream,
    TreeStreamImpl,
} from "langium";
import { Position, Range } from "vscode-languageserver";
import { Alias, Element, Feature, isAlias, isElement } from "../generated/ast";
import { SpecializationKind } from "../model/enums";
import { resolveAlias } from "../model/util";
import { SysMLNodeDescription } from "../services/shared/workspace/ast-descriptions";
import { AssignableKeys, DeepReadonly } from "./common";

/**
 * Visibility level.
 *
 * For example, to check if an `element` is visible from protected use
 * `element.visibility <= Visibility.protected`
 */
export const enum Visibility {
    public = 0,
    protected = 1,
    private = 2,
}

export type AliasResolver = (node: Alias) => Element | undefined;

export interface VisibilityOptions {
    /**
     * Visibility level filter
     */
    visibility: Visibility;

    /**
     * Number of nested scopes `visibility` applies to including the root scope
     */
    depth: number;

    /**
     * Next set of visibility options after depth reaches 0, defaults to public
     * visibility
     */
    next?: VisibilityOptions;
}

export interface ContentsOptions {
    imported: VisibilityOptions;
    inherited: VisibilityOptions;
    aliasResolver: undefined | AliasResolver;
    visited: Set<object>;
    specializations: Set<AstNode>;
}
export type PartialContentOptions = Partial<ContentsOptions>;

export const DEFAULT_ALIAS_RESOLVER: AliasResolver = (node) => resolveAlias(node, isElement);

export const PARENT_CONTENTS_OPTIONS: DeepReadonly<PartialContentOptions> = {
    // private visibility by default for parent scopes
    imported: {
        visibility: Visibility.private,
        depth: 1,
    },
    inherited: {
        visibility: Visibility.private,
        depth: 1,
    },
    aliasResolver: DEFAULT_ALIAS_RESOLVER,
};

export const CHILD_CONTENTS_OPTIONS: DeepReadonly<PartialContentOptions> = {
    // only publicly visible contents by default
    imported: {
        visibility: Visibility.public,
        depth: 0,
    },
    inherited: {
        visibility: Visibility.public,
        depth: 0,
    },
    aliasResolver: undefined,
};

export function resolveVisibility(opts: Partial<VisibilityOptions>): VisibilityOptions {
    return {
        visibility: opts.visibility ?? Visibility.public,
        depth: opts.depth ?? 10000000,
        next: opts.next,
    };
}

const DEFAULT_VISIBILITY: Readonly<VisibilityOptions> = {
    visibility: Visibility.public,
    depth: 0,
    next: undefined,
};

export function decrementVisibility(options: VisibilityOptions): VisibilityOptions {
    const depth = options.depth - 1;
    if (depth < 0) {
        if (options.next) return resolveVisibility(options.next);
        return DEFAULT_VISIBILITY;
    }

    return { visibility: options.visibility, depth, next: options.next };
}

export function fillContentOptions({
    imported = DEFAULT_VISIBILITY,
    inherited = DEFAULT_VISIBILITY,
    aliasResolver = DEFAULT_ALIAS_RESOLVER,
    visited = undefined,
    specializations = undefined,
}: PartialContentOptions = {}): ContentsOptions {
    const cache = visited ?? new Set();
    const specs = specializations ?? new Set();
    return {
        imported: resolveVisibility(imported),
        inherited: resolveVisibility(inherited),
        aliasResolver: aliasResolver,
        visited: cache,
        specializations: specs,
    };
}

/**
 * Resolve element for contents and fill in partial options
 * @param description
 * @param opts
 * @returns
 */
export function resolveContentInputs(
    description: SysMLNodeDescription | AstNode,
    opts?: PartialContentOptions
): { element?: Element; options: ContentsOptions } {
    const options = fillContentOptions(opts);
    const node = isAstNode(description) ? description : description.node;
    let resolved: Element | undefined = undefined;
    if (node && options.aliasResolver && isAlias(node)) resolved = options.aliasResolver(node);
    else if (isElement(node)) resolved = node;

    return {
        element: resolved,
        options: options,
    };
}

/**
 * Recursively collect feature redefinitions into `redefinitions`
 * @param feature Top level feature to collect redefinitions for
 * @param redefinitions
 */
export function collectRedefinitions(feature: Feature, redefinitions: Set<object>): void {
    const visitRedefinitions = (node: Feature): void => {
        node.$meta.types(SpecializationKind.Redefinition).forEach((t) => {
            // only features can be redefined
            const f = t as Feature;
            if (redefinitions.has(f)) return;
            redefinitions.add(f);
            visitRedefinitions(f);
        });
    };

    visitRedefinitions(feature);
}

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
 * Create a stream of all parents to {@link root}, including the root node
 * itself
 * @param root
 * @returns
 */
export function streamParents(root: AstNode): Stream<AstNode> {
    return new TreeStreamImpl(
        root,
        (node) => {
            return node.$container ? [node.$container] : EMPTY_STREAM;
        },
        { includeRoot: true }
    );
}

export interface ScopeOptions {
    /**
     * Alias resolution function, i.e. a linker may want to link an alias if it
     * is not linked yet while other services would simply follow to the alias
     * target
     */
    aliasResolver?: AliasResolver;

    /**
     * Element to skip in the root namespace
     */
    skip?: AstNode;

    /**
     * Set of already visited/resolved AST nodes
     */
    visited?: Set<AstNode>;

    /**
     * Skip parent scopes
     */
    skipParents?: boolean;
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
