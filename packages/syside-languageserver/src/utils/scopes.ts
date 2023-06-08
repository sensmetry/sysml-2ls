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
    EMPTY_STREAM,
    Scope,
    stream,
    Stream,
    StreamImpl,
    TreeStream,
    TreeStreamImpl,
} from "langium";
import {
    Element,
    isNamespace,
    isOwningMembership,
    Membership,
    MembershipImport,
    Namespace,
    OwningMembership,
} from "../generated/ast";
import {
    ElementMeta,
    NamespaceMeta,
    typeIndex,
    TypeMap,
    TypeMeta,
    ImportMeta,
    Metamodel,
    MembershipMeta,
    MembershipImportMeta,
    NamespaceImportMeta,
    namedMembership,
    OwningMembershipMeta,
} from "../model";
import { SysMLNodeDescription } from "../services/shared/workspace/ast-descriptions";
import { SysMLType, SysMLTypeList } from "../services/sysml-ast-reflection";
import {
    Visibility,
    ContentsOptions,
    PartialContentOptions,
    resolveContentInputs,
    decrementVisibility,
    ScopeOptions,
    fillContentOptions,
    PARENT_CONTENTS_OPTIONS,
    streamParents,
    isVisibleWith,
} from "./scope-util";

/**
 * Tuple of [exported name, membership]
 */
export type ExportedMember = [string, MembershipMeta];

/**
 * An abstract class used to lazily construct scope for SysML name resolution
 */
export abstract class SysMLScope implements Scope {
    getAllExportedElements(): Stream<ExportedMember> {
        const ignored = new Set<string>();
        const tree = new TreeStreamImpl(
            [ignored, this as SysMLScope] as const,
            // need to create a copy of the set on every new child scope so that
            // the changes don't propagate back up, only down to children
            ([ignored, scope]) => scope.getChildScopes().map((s) => [new Set(ignored), s] as const),
            {
                includeRoot: true,
            }
        );

        return tree
            .flatMap(([ignored, scope]) =>
                scope.getAllLocalElements(ignored).filter(([name]) => !ignored.has(name))
            )
            .distinct(([name]) => name);
    }

    getAllElements(): Stream<SysMLNodeDescription> {
        return (
            this.getAllExportedElements()
                // each membership may be exported with multiple names
                .distinct(([_, m]) => m)
                .map(([_, e]) => e.description)
                .nonNullable()
        );
    }

    getExportedElement(name: string): MembershipMeta | undefined {
        const iterator = this.getAllScopes(true).iterator();

        let current = iterator.next();
        while (!current.done) {
            const candidate = current.value.getLocalElement(name);
            if (candidate === "prune") {
                iterator.prune();
            } else if (candidate && this.isValidCandidate(candidate)) {
                return candidate;
            }

            current = iterator.next();
        }

        return;
    }

    getElement(name: string): SysMLNodeDescription | undefined {
        return this.getExportedElement(name)?.description;
    }

    /**
     *
     * @param includeSelf if true, include this scope in the stream
     * @returns Stream of all owned, inherited and imported scopes
     */
    getAllScopes(includeSelf = true): TreeStream<SysMLScope> {
        // need to cast this since this is treated as distinct type
        const scopes = new TreeStreamImpl(this as SysMLScope, (scope) => scope.getChildScopes(), {
            includeRoot: includeSelf,
        });
        return scopes;
    }

    /**
     * Get all directly inherited and imported scopes by this scope
     */
    protected abstract getChildScopes(): Stream<SysMLScope>;

    /**
     * Find an element by {@link name} in this scope only
     * @param name element name
     */
    protected abstract getLocalElement(name: string): MembershipMeta | "prune" | undefined;

    /**
     * Stream all owned elements in this scope only after applying filtering
     * @param ignored add names that should be ignored inside children scopes,
     */
    protected abstract getAllLocalElements(ignored: Set<string>): Stream<ExportedMember>;

    /**
     * Check if an AST node can be returned by {@link getElement} (e.g. it is not hidden by redefinitions)
     * @param candidate AST node description to check
     * @returns true if {@link candidate} is visible to {@link getElement}, false otherwise
     */
    // eslint-disable-next-line unused-imports/no-unused-vars
    protected isValidCandidate(candidate: MembershipMeta): boolean {
        return true;
    }
}

class EmptySysMLScope extends SysMLScope {
    protected override getLocalElement(_: string): MembershipMeta | undefined {
        return;
    }
    protected override getAllLocalElements(): Stream<ExportedMember> {
        return EMPTY_STREAM;
    }
    protected override getChildScopes(): Stream<SysMLScope> {
        return EMPTY_STREAM;
    }
}

export const EMPTY_SYSML_SCOPE = new EmptySysMLScope();

export class ElementScope extends SysMLScope {
    /**
     * Scope owning element
     */
    readonly element: ElementMeta;

    /**
     * Scope access options
     */
    options: ContentsOptions;

    constructor(element: ElementMeta, options: ContentsOptions) {
        super();
        this.element = element;
        this.options = options;
    }

    protected override getChildScopes(): Stream<SysMLScope> {
        return EMPTY_STREAM;
    }

    protected override getLocalElement(name: string): MembershipMeta | "prune" | undefined {
        const candidate = this.element.findMember(name);
        if (typeof candidate === "string") {
            if (candidate === "unresolved reference") throw candidate;
            // name is shadowed by this scope so prune any child scopes
            return "prune";
        }

        if (candidate && this.isVisible(candidate)) return namedMembership(candidate);
        return;
    }

    protected override getAllLocalElements(ignored: Set<string>): Stream<ExportedMember> {
        // unnamed/shadowed elements are not exported
        return stream(this.element.namedMembers)
            .map(([name, child]) => {
                if (child === "shadow") {
                    ignored.add(name);
                    return;
                }
                if (child === "unresolved reference") {
                    return;
                }

                const element = namedMembership(child);
                if (!element || !this.isVisible(child)) return;
                return [name, element];
            })
            .filter((t): t is ExportedMember => Boolean(t));
    }

    /**
     * Check if {@link exported} is visible outside this scope
     * @param exported element description
     * @returns true if {@link exported} is visible outside of this scope, false otherwise
     */
    protected isVisible(exported: MembershipImportMeta | MembershipMeta): boolean {
        return (
            isVisibleWith(exported.visibility, this.options.inherited.visibility) &&
            !this.options.visited.has(namedMembership(exported)?.element())
        );
    }

    protected override isValidCandidate(candidate: MembershipMeta): boolean {
        return !this.options.visited.has(candidate.element());
    }
}

export abstract class ImportScope extends ElementScope {
    override readonly element: ImportMeta;

    constructor(element: ImportMeta, options: ContentsOptions) {
        super(element, { ...options });
        this.element = element;

        if (this.element.importsAll) {
            this.options.inherited = { depth: 1000000, visibility: Visibility.private };
            this.options.imported = { depth: 1000000, visibility: Visibility.private };
        }
    }

    protected override getLocalElement(_name: string): MembershipMeta | undefined {
        // cannot reference import owned elements
        return;
    }

    protected override getAllLocalElements(): Stream<ExportedMember> {
        // children not visible to outside
        return EMPTY_STREAM;
    }

    protected abstract override getChildScopes(): Stream<SysMLScope>;

    /**
     * Construct a stream of scopes for recursive imports
     * @param target
     * @returns Recursive stream of scopes starting at {@link target}
     */
    protected makeRecursiveScope(target: ElementMeta): Stream<SysMLScope> {
        // only the owned namespace members are recursively imported
        if (!target.is(Namespace)) return EMPTY_STREAM;
        const node = target.ast();
        let namespaces: Stream<NamespaceMeta>;

        if (node) {
            // TODO: remove when model order is preserved, works for now since
            // we don't add new namespace members at runtime
            namespaces = new TreeStreamImpl(
                node,
                (child) =>
                    child.$children
                        .filter(isOwningMembership)
                        .map((m) => m.element)
                        .filter(isNamespace),
                {
                    includeRoot: true,
                }
            ).map((ns) => ns.$meta);
        } else {
            namespaces = new TreeStreamImpl(
                target,
                (ns) =>
                    stream(ns.children)
                        .filter((m): m is OwningMembershipMeta => m.is(OwningMembership))
                        .map((m) => m.element())
                        .filter((e): e is NamespaceMeta => Boolean(e?.is(Namespace))),
                { includeRoot: true }
            );
        }

        return namespaces.map((ns) => makeScope(ns, this.options));
    }
}

export class MembershipImportScope extends ImportScope {
    override readonly element: MembershipImportMeta;

    constructor(element: MembershipImportMeta, options: ContentsOptions) {
        super(element, { ...options });
        this.element = element;
    }

    protected override getChildScopes(): Stream<SysMLScope> {
        const target = this.element.element()?.element();
        if (!target || !this.element.isRecursive) return EMPTY_STREAM;
        return this.makeRecursiveScope(target);
    }
}

export class NamespaceImportScope extends ImportScope {
    override readonly element: NamespaceImportMeta;

    constructor(element: NamespaceImportMeta, options: ContentsOptions) {
        super(element, { ...options });
        this.element = element;
    }

    protected override getChildScopes(): Stream<SysMLScope> {
        const element = this.element.element();
        if (!element) return EMPTY_STREAM;
        if (this.element.isRecursive) return this.makeRecursiveScope(element);

        return stream([makeScope(element, this.options)]);
    }
}

export class NamespaceScope extends ElementScope {
    override readonly element: NamespaceMeta;

    constructor(element: NamespaceMeta, options: ContentsOptions) {
        super(element, {
            ...options,
            inherited: decrementVisibility(options.inherited),
            imported: decrementVisibility(options.imported),
        });
        this.element = element;
    }

    protected override getChildScopes(): Stream<SysMLScope> {
        return this.getInheritedScopes().concat(
            stream(this.element.imports).map((imp) => {
                if (
                    (!imp.importsAll && imp.visibility > this.options.imported.visibility) ||
                    imp.importsNameOnly() ||
                    this.options.visited.has(imp)
                )
                    return EMPTY_SYSML_SCOPE; // hidden import or already imported
                // imported with the import visibility
                // prevent infinite loops
                this.options.visited.add(imp);
                return imp.is(MembershipImport)
                    ? new MembershipImportScope(imp, this.options)
                    : new NamespaceImportScope(imp as NamespaceImportMeta, this.options);
            })
        );
    }

    /**
     * @returns stream of all directly inherited scopes
     */
    protected getInheritedScopes(): Stream<SysMLScope> {
        // not a type so no inherited scopes
        return EMPTY_STREAM;
    }
}

export class TypeScope extends NamespaceScope {
    override readonly element: TypeMeta;

    constructor(element: TypeMeta, options: ContentsOptions) {
        super(element, options);
        this.element = element;
    }

    protected override getInheritedScopes(): Stream<SysMLScope> {
        const scopes: SysMLScope[] = [];
        const visited = this.options.visited;
        const specializations = this.options.specializations;
        specializations.add(this.element);

        const inherited = decrementVisibility(this.options.inherited);
        for (const specialization of this.element.specializations()) {
            // ignore already visited general types, since the streams are lazy
            // unless the cache was not empty on the initial call, it will contain
            // only the general classes use a suffixed name for duplicate resolution
            // so that it doesn't clash with parent and imported scopes
            const specialized = specialization.finalElement();
            if (!specialized || specializations.has(specialized)) continue;
            specializations.add(specialized);

            // TODO: add mapped object caches of elements in scope and skip this
            // this will recursively stream other inherited and imported elements
            // isolate base scopes from the supertype scope
            scopes.push(
                new TypeScope(specialized, {
                    ...this.options,
                    // use the same visibility for imported members from inherited scopes as
                    // they are essentially the same in this case
                    inherited: inherited,
                    imported: inherited,
                    visited: new Set(visited),
                    specializations: new Set(specializations),
                })
            );
        }

        return stream(scopes);
    }
}

/**
 * A scope wrapper for an iterable of {@link SysMLScope}
 */
export class ScopeStream extends SysMLScope {
    scopes: Iterable<SysMLScope>;

    constructor(scopes: Iterable<SysMLScope>) {
        super();
        this.scopes = scopes;
    }
    override getChildScopes(): Stream<SysMLScope> {
        if (this.scopes instanceof StreamImpl) return this.scopes as Stream<SysMLScope>;
        return stream(this.scopes);
    }
    protected override getLocalElement(_name: string): MembershipMeta | undefined {
        return;
    }
    protected override getAllLocalElements(): Stream<ExportedMember> {
        return EMPTY_STREAM;
    }
}

export class FilteredScope extends SysMLScope {
    /**
     * Scope to filter
     */
    scope: SysMLScope;

    /**
     * Filter predicate that returns true if an element is propagated from
     * {@link scope}
     */
    predicate: (d: MembershipMeta) => boolean;

    constructor(scope: SysMLScope, predicate: (d: MembershipMeta) => boolean) {
        super();
        this.scope = scope;
        this.predicate = predicate;
    }
    override getAllScopes(includeSelf?: boolean | undefined): TreeStream<SysMLScope> {
        return this.scope.getAllScopes(includeSelf);
    }
    override getAllExportedElements(): Stream<ExportedMember> {
        return this.scope.getAllExportedElements().filter(([_, m]) => this.predicate(m));
    }
    protected override getChildScopes(): Stream<SysMLScope> {
        return this.scope["getChildScopes"]();
    }
    protected override getLocalElement(name: string): MembershipMeta | "prune" | undefined {
        const candidate = this.scope["getLocalElement"](name);
        if (typeof candidate === "object") return this.predicate(candidate) ? candidate : undefined;
        return candidate;
    }
    protected override getAllLocalElements(ignored: Set<string>): Stream<ExportedMember> {
        return this.scope["getAllLocalElements"](ignored).filter(([_, m]) => this.predicate(m));
    }
    protected override isValidCandidate(candidate: MembershipMeta): boolean {
        return this.predicate(candidate);
    }
}

type ScopeConstructor<T extends Metamodel = Metamodel> = new (
    node: T,
    options: ContentsOptions
) => SysMLScope;

let SCOPE_MAP: undefined | Map<string, ScopeConstructor> = undefined;

const SCOPE_CONSTRUCTORS: {
    readonly [K in SysMLType]?: ScopeConstructor<NonNullable<SysMLTypeList[K]["$meta"]>>;
} = {
    Element: ElementScope,
    Namespace: NamespaceScope,
    NamespaceImport: NamespaceImportScope,
    MembershipImport: MembershipImportScope,
    Type: TypeScope,
};

/**
 * Construct a scope for {@link node} with given {@link opts}
 * @param node
 * @param opts Scope options
 * @returns Scope for {@link node}
 */
export function makeScope(
    node: Metamodel | undefined,
    opts: PartialContentOptions = {}
): SysMLScope {
    if (!node) return EMPTY_SYSML_SCOPE;
    const { element, options } = resolveContentInputs(node, opts);

    if (!element) return EMPTY_SYSML_SCOPE;
    if (!SCOPE_MAP) {
        SCOPE_MAP = typeIndex.expandToDerivedTypes(
            SCOPE_CONSTRUCTORS as TypeMap<SysMLTypeList, ScopeConstructor>
        );
    }

    let target = element.is(Membership) ? element.element() : element;
    target ??= element;

    const ctor = SCOPE_MAP.get(target.nodeType());
    if (ctor) return new ctor(target, options);
    return EMPTY_SYSML_SCOPE;
}

const EMPTY_SCOPE_STREAM = new ScopeStream(EMPTY_STREAM);

/**
 * Construct a scope that can be used for linking the first reference the
 * qualified chain
 * @param root Root element
 * @param options Scope options
 * @param global Optional global scope
 * @returns A scope stream with {@link ScopeStream.getChildScopes} returning
 * scopes ordered by their distance to root
 */
export function makeLinkingScope(
    root: Metamodel | undefined,
    options: ScopeOptions = {},
    global?: SysMLScope
): ScopeStream {
    if (!root) return EMPTY_SCOPE_STREAM;
    options.visited ??= new Set();

    let parentScopes: Stream<SysMLScope> = EMPTY_STREAM;
    const parent = root.owner();
    if (parent && !options.skipParents) {
        const parents = streamParents(parent);
        const scopeOptions = fillContentOptions({
            ...PARENT_CONTENTS_OPTIONS,
            aliasResolver: options.aliasResolver,
            // all direct children are visible
            imported: { visibility: Visibility.private, depth: 1 },
            inherited: { visibility: Visibility.private, depth: 1 },
        });
        parentScopes = parents
            .filter((p) => p.is(Element))
            .map((parent) =>
                makeScope(parent, {
                    ...scopeOptions,
                    // redefinitions are only valid in the owning scope
                    visited: new Set(),
                    specializations: new Set(),
                })
            );
    }

    // global scope is a kind of parent
    if (global && !options.skipParents) {
        // if in root namespace already, make sure the global scope also skips
        // the provided skip element
        if (root.parent() || !options.skip) parentScopes = parentScopes.concat([global]);
        else
            parentScopes = parentScopes.concat([
                new FilteredScope(global, (d) => d.element() !== options.skip),
            ]);
    }

    const rootScope = makeScope(root, {
        aliasResolver: options.aliasResolver,
        visited: options.visited,
        imported: {
            // root scope has private members visible but not transitively
            visibility: Visibility.private,
            depth: 1,
        },
        inherited: {
            // private members visible in root scope
            visibility: Visibility.private,
            depth: 1,
            // private members hidden in base scopes
            next: { visibility: Visibility.protected, depth: 1000000 },
        },
    });

    if (!options.skip) {
        return new ScopeStream(stream([rootScope]).concat(parentScopes));
    }

    return new ScopeStream(
        stream([new FilteredScope(rootScope, (d) => d.element() !== options.skip)]).concat(
            parentScopes
        )
    );
}
