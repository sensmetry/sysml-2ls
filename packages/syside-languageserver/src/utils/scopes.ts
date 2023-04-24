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

import { EMPTY_STREAM, Scope, stream, Stream, StreamImpl, TreeStreamImpl } from "langium";
import { Element, Membership, MembershipImport } from "../generated/ast";
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
} from "../model";
import { SysMLNodeDescription } from "../services/shared/workspace/ast-descriptions";
import { SysMLType, SysMLTypeList } from "../services/sysml-ast-reflection";
import {
    collectRedefinitions,
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
 * An abstract class used to lazily construct scope for SysML name resolution
 */
export abstract class SysMLScope implements Scope {
    getAllExportedElements(): Stream<MembershipMeta> {
        return this.getAllScopes()
            .flatMap((scope) => scope.getAllLocalElements())
            .distinct();
    }

    getAllElements(): Stream<SysMLNodeDescription> {
        return this.getAllExportedElements()
            .map((e) => e.description)
            .nonNullable();
    }

    getExportedElement(name: string): MembershipMeta | undefined {
        for (const scope of this.getAllScopes(true)) {
            const candidate = scope.getLocalElement(name);
            if (candidate && this.isValidCandidate(candidate)) return candidate;
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
    getAllScopes(includeSelf = true): Stream<SysMLScope> {
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
    protected abstract getLocalElement(name: string): MembershipMeta | undefined;

    /**
     * Stream all owned elements in this scope only after applying filtering
     */
    protected abstract getAllLocalElements(): Stream<MembershipMeta>;

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
    protected override getAllLocalElements(): Stream<MembershipMeta> {
        return EMPTY_STREAM;
    }
    protected override getChildScopes(): Stream<SysMLScope> {
        return EMPTY_STREAM;
    }
}

export const EMPTY_SYSML_SCOPE = new EmptySysMLScope();

/**
 * A scope wrapper for an iterable of {@link MembershipMeta}
 */
export class SimpleScope extends SysMLScope {
    /**
     * Descriptions in this scope
     */
    exported: MembershipMeta[];

    constructor(exported: MembershipMeta[]) {
        super();
        this.exported = exported;
    }

    protected override getChildScopes(): Stream<SysMLScope> {
        return EMPTY_STREAM;
    }
    protected override getLocalElement(name: string): MembershipMeta | undefined {
        return this.exported.find((m) => m.name === name || m.shortName === name);
    }
    protected override getAllLocalElements(): Stream<MembershipMeta> {
        return stream(this.exported);
    }
    override getAllScopes(): Stream<SysMLScope> {
        return stream([this]);
    }
    override getExportedElement(name: string): MembershipMeta | undefined {
        return this.getLocalElement(name);
    }
    override getAllExportedElements(): Stream<MembershipMeta> {
        return this.getAllLocalElements();
    }
}

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

        // collect all redefinitions now to hide elements in nested scopes
        const features = this.element.features;
        for (const member of features) {
            const feature = member.element();
            if (feature) collectRedefinitions(feature, options.visited);
        }
    }

    protected override getChildScopes(): Stream<SysMLScope> {
        return EMPTY_STREAM;
    }

    protected override getLocalElement(name: string): MembershipMeta | undefined {
        const candidate = this.element.children.get(name);
        if (candidate && this.isVisible(candidate)) return candidate;
        return;
    }

    protected override getAllLocalElements(): Stream<MembershipMeta> {
        return stream(this.element.members).filter((d) => this.isVisible(d));
    }

    /**
     * Check if {@link exported} is visible outside this scope
     * @param exported element description
     * @returns true if {@link exported} is visible outside of this scope, false otherwise
     */
    protected isVisible(exported: MembershipMeta): boolean {
        return (
            isVisibleWith(exported.visibility, this.options.inherited.visibility) &&
            !this.options.visited.has(exported.element())
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

    protected override getAllLocalElements(): Stream<MembershipMeta> {
        // children not visible to outside
        return EMPTY_STREAM;
    }

    protected abstract override getChildScopes(): Stream<SysMLScope>;

    /**
     * Construct a stream of scopes for recursive imports
     * @param description
     * @returns Recursive stream of scopes starting at {@link description}
     */
    protected makeRecursiveScope(description: ElementMeta): Stream<SysMLScope> {
        // make sure this doesn't end up in an infinite loop by discarding
        // already visited elements
        const visited = new Set(this.options.visited);
        return new TreeStreamImpl(
            makeScope(description, this.options),
            (scope) =>
                scope
                    .getAllExportedElements()
                    .filter((d) => {
                        if (visited.has(d)) return false;
                        visited.add(d);
                        return true;
                    })
                    .map((d) => makeScope(d.element(), this.options)),
            { includeRoot: true }
        );
    }

    /**
     * Construct a simple scope for {@link d}
     * @param d AST node description
     * @returns Scope of a single element {@link d} if it is not hidden,
     * undefined otherwise
     */
    protected makeDescriptionScope(d: MembershipMeta): SysMLScope | undefined {
        if (!this.options.visited.has(d.name)) return new SimpleScope([d]);
        return;
    }
}

export class MembershipImportScope extends ImportScope {
    override readonly element: MembershipImportMeta;

    constructor(element: MembershipImportMeta, options: ContentsOptions) {
        super(element, { ...options });
        this.element = element;
    }

    protected override getChildScopes(): Stream<SysMLScope> {
        let s = EMPTY_STREAM;
        const description = this.element.element();
        if (!description) return s;

        if (!this.options.visited.has(description)) s = stream([new SimpleScope([description])]);
        if (!this.element.isRecursive) return s;

        return s.concat(this.makeRecursiveScope(description));
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

        return stream([makeScope(this.element.element(), this.options)]);
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
    protected override getAllLocalElements(): Stream<MembershipMeta> {
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
    override getAllScopes(includeSelf?: boolean | undefined): Stream<SysMLScope> {
        return this.scope.getAllScopes(includeSelf);
    }
    override getAllExportedElements(): Stream<MembershipMeta> {
        return this.scope.getAllExportedElements().filter(this.predicate);
    }
    protected override getChildScopes(): Stream<SysMLScope> {
        return this.scope["getChildScopes"]();
    }
    protected override getLocalElement(name: string): MembershipMeta | undefined {
        const candidate = this.scope["getLocalElement"](name);
        if (candidate && this.predicate(candidate)) return candidate;
        return;
    }
    protected override getAllLocalElements(): Stream<MembershipMeta> {
        return this.scope["getAllLocalElements"]().filter(this.predicate);
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
    if (global && !options.skipParents) parentScopes = parentScopes.concat([global]);

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
