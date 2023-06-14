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

import { Stream, stream, EMPTY_STREAM, LangiumDocument } from "langium";
import { URI, Utils } from "vscode-uri";
import { NamespaceScope, SysMLScope, ExportedMember } from "./scopes";
import { Namespace } from "../generated/ast";
import { MembershipMeta, NamespaceMeta, ElementMeta, namedMembership } from "../model";
import { erase } from "./common";
import { Visibility, DEFAULT_ALIAS_RESOLVER } from "./scope-util";

/**
 * Get a language ID from a URI
 */
export function getLanguageId(uri: URI): string {
    return Utils.extname(uri).toLowerCase();
}

type ScopeEntry = {
    member: MembershipMeta;
    langId: string;
};

type DynamicExportMap = Map<string, NamespaceMeta>;
type ExportIndex = Record<string, DynamicExportMap>;

function getExports(exports: ExportIndex, langId?: string): Stream<NamespaceScope> {
    let namespaces: Stream<NamespaceMeta>;
    if (!langId) namespaces = stream(Object.values(exports)).flatMap((map) => map.values());
    else
        namespaces = stream(exports[langId]?.values() ?? []).concat(
            stream(Object.keys(exports))
                .filter((k) => k !== langId)
                .flatMap((k) => exports[k].values())
        );

    return namespaces.map(
        (ns) =>
            new NamespaceScope(ns, {
                imported: { visibility: Visibility.public, depth: 0 },
                inherited: { visibility: Visibility.public, depth: 0 },
                visited: new Set(),
                specializations: new Set(),
                aliasResolver: DEFAULT_ALIAS_RESOLVER,
            })
    );
}

function getFromEntries(entries: ScopeEntry[], langId?: string): MembershipMeta | undefined {
    if (langId) {
        // prioritizing entries matching the provided langId
        const candidate = entries.filter((entry) => entry.langId === langId).at(-1)?.member;
        if (candidate) return candidate;
    }

    return entries.at(-1)?.member;
}

export class GlobalScope extends SysMLScope {
    // not using multi map since we want to be able to remove entries by
    // documents, allowing multiple entries per name so that shadows can be
    // resolved even after document update
    protected readonly staticExports: Map<string, ScopeEntry[]> = new Map();
    /**
     * cache of static document exports to improve performance of removing
     * exports from `staticExports` on document invalidation
     */
    protected readonly documentStaticExports: Map<string, [string, ScopeEntry][]> = new Map();

    /**
     * fallback for full scope resolution in case name was not found in static
     * exports
     */
    protected readonly dynamicExports: ExportIndex = {};

    /**
     * all root namespaces for use in completion generation
     */
    protected readonly allExports: ExportIndex = {};

    /**
     *
     * @param name member name
     * @param langId language id, i.e. `.kerml` or `.sysml`, used to resolve shadows
     * @returns
     */
    override getExportedElement(
        name: string,
        langId?: string
    ): MembershipMeta<ElementMeta> | undefined {
        const value = this.getLocalElement(name, langId);
        if (typeof value === "object") return value;
        return;
    }

    getStaticExportedElement(name: string, langId?: string): MembershipMeta | undefined {
        const entries = this.staticExports.get(name);
        if (entries) {
            const candidate = getFromEntries(entries, langId);
            if (candidate) return candidate;
        }
        return;
    }

    protected getDynamicExportedElement(name: string, langId?: string): MembershipMeta | undefined {
        for (const ns of this.getDynamicExports(langId)) {
            const candidate = ns.getExportedElement(name);
            if (candidate) return candidate;
        }

        return;
    }

    override getAllExportedElements(langId?: string): Stream<ExportedMember> {
        return this.getAllLocalElements(new Set(), langId);
    }

    protected getChildScopes(): Stream<SysMLScope> {
        return EMPTY_STREAM;
    }
    protected getLocalElement(
        name: string,
        langId?: string
    ): MembershipMeta<ElementMeta> | "prune" | undefined {
        return (
            this.getStaticExportedElement(name, langId) ??
            this.getDynamicExportedElement(name, langId)
        );
    }

    protected getAllLocalElements(ignored: Set<string>, langId?: string): Stream<ExportedMember> {
        return stream(this.staticExports)
            .map(([name, entries]) => [name, getFromEntries(entries, langId)] as const)
            .filter((t): t is ExportedMember => Boolean(t[1]))
            .concat(this.getDynamicExports(langId).flatMap((ns) => ns.getAllExportedElements()))
            .distinct(([name]) => name);
    }

    protected getDynamicExports(langId?: string): Stream<NamespaceScope> {
        return getExports(this.dynamicExports, langId);
    }

    invalidateDocuments(uris: URI[]): void {
        // members are using weak refs so we can skip them
        // need to remove old imports
        uris.forEach((uri) => {
            const id = getLanguageId(uri);
            const uriStr = uri.toString();

            this.dynamicExports[id]?.delete(uriStr);
            this.allExports[id]?.delete(uriStr);

            this.documentStaticExports.get(uriStr)?.forEach(([name, entry]) => {
                const entries = this.staticExports.get(name);
                if (entries) erase(entries, entry);
            });
            this.documentStaticExports.delete(uriStr);
        });
    }

    collectDocument(document: LangiumDocument<Namespace>): void {
        const root = document.parseResult.value.$meta;
        const langId = getLanguageId(document.uri);

        const exports: [string, ScopeEntry][] = [];
        for (const [name, child] of root.namedMembers) {
            if (typeof child !== "object" || child.visibility !== Visibility.public) continue;
            const member = namedMembership(child);
            if (!member) continue;
            exports.push([name, { langId, member }]);
        }

        this.documentStaticExports.set(document.uriString, exports);
        exports.forEach(([name, entry]) => {
            let entries = this.staticExports.get(name);
            if (!entries) {
                entries = [];
                this.staticExports.set(name, entries);
            }

            entries.push(entry);
        });

        const addExports = (exports: ExportIndex): void => {
            (exports[langId] ??= new Map()).set(document.uriString, root);
        };

        addExports(this.allExports);

        // DO NOT ADD NAMESPACES WITH ONLY STATICALLY KNOWN EXPORTS. We do not
        // need to check a namespace for dynamically exported symbols if it has
        // no public dynamic exports WHICH ALL SANE DOCUMENTS SHOULD DO. If all
        // documents follow this, then the dynamic exports will remain empty and
        // not deteriorate performance when a name is not found in static
        // exports map.
        if (
            root.imports.some((imp) => imp.visibility === Visibility.public) ||
            root.featureMembers().some((m) => {
                if (m.visibility !== Visibility.public) return false;
                const target = m.element();
                if (!target) return false;
                // unnamed features may get implicit name after reference
                // resolution, treating them as dynamic exports
                return !target.name && !target.shortName;
            })
        )
            addExports(this.dynamicExports);
    }

    wrapForLang(langId?: string): SysMLScope {
        class GlobalLangScope extends SysMLScope {
            constructor(readonly scope: GlobalScope, readonly langId?: string) {
                super();
            }

            protected getChildScopes(): Stream<SysMLScope> {
                return this.scope.getChildScopes();
            }
            protected getLocalElement(
                name: string
            ): MembershipMeta<ElementMeta> | "prune" | undefined {
                return this.scope.getLocalElement(name, this.langId);
            }
            protected getAllLocalElements(ignored: Set<string>): Stream<ExportedMember> {
                return this.scope.getAllLocalElements(ignored, this.langId);
            }

            override getExportedElement(name: string): MembershipMeta<ElementMeta> | undefined {
                return this.scope.getExportedElement(name, this.langId);
            }

            override getAllExportedElements(): Stream<ExportedMember> {
                return this.scope.getAllExportedElements(this.langId);
            }
        }

        return new GlobalLangScope(this, langId);
    }
}
