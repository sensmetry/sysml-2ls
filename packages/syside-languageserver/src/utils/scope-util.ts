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

import { Stream, TreeStreamImpl, EMPTY_STREAM } from "langium";
import { Element, Membership, Redefinition } from "../generated/ast";
import { ElementMeta, Metamodel, FeatureMeta, MembershipMeta } from "../model";
import { DeepReadonly } from "./common";

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

export function isVisibleWith(visibility: Visibility, constraint: Visibility): boolean {
    return visibility <= constraint;
}

export type AliasResolver = (node: MembershipMeta) => ElementMeta | undefined;

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
    visited: Set<ElementMeta | string | undefined>;
    specializations: Set<Metamodel>;
}
export type PartialContentOptions = Partial<ContentsOptions>;

export const DEFAULT_ALIAS_RESOLVER: AliasResolver = (node) => node.element();

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
 * @param node
 * @param opts
 * @returns
 */
export function resolveContentInputs(
    node: Metamodel,
    opts?: PartialContentOptions
): { element?: ElementMeta; options: ContentsOptions } {
    const options = fillContentOptions(opts);
    let resolved: ElementMeta | undefined = undefined;
    if (node && options.aliasResolver && node.is(Membership))
        resolved = options.aliasResolver(node);
    else if (node.is(Element)) resolved = node;

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
export function collectRedefinitions<T>(
    feature: FeatureMeta,
    redefinitions: Set<ElementMeta | T>
): void {
    const visitRedefinitions = (node: FeatureMeta): void => {
        node.types(Redefinition).forEach((t) => {
            // only features can be redefined
            const f = t as FeatureMeta;
            if (redefinitions.has(f)) return;
            redefinitions.add(f);
            visitRedefinitions(f);
        });
    };

    visitRedefinitions(feature);
}

/**
 * Create a stream of all parents to {@link root}, including the root node
 * itself
 * @param root
 * @returns
 */
export function streamParents(root: Metamodel): Stream<Metamodel> {
    return new TreeStreamImpl(
        root,
        (node) => {
            const parent = node.owner();
            return parent ? [parent] : EMPTY_STREAM;
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
    skip?: Metamodel;

    /**
     * Set of already visited/resolved AST nodes
     */
    visited?: ContentsOptions["visited"];

    /**
     * Skip parent scopes
     */
    skipParents?: boolean;
}
