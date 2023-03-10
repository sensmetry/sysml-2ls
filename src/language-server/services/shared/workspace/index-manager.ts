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
    DefaultIndexManager,
    DocumentState,
    EMPTY_STREAM,
    LangiumDocument,
    stream,
    Stream,
} from "langium";
import { CancellationToken } from "vscode-languageserver";
import { URI, Utils } from "vscode-uri";
import { Type, isElement, Namespace, Membership } from "../../../generated/ast";
import { ElementMeta, MembershipMeta, TypeMeta } from "../../../model";
import { streamAst } from "../../../utils/ast-util";
import { makeScope, ScopeStream } from "../../../utils/scopes";
import { SysMLScopeComputation } from "../../references/scope-computation";
import { SysMLDefaultServices } from "../../services";
import { SysMLNodeDescription } from "./ast-descriptions";

/**
 * Overrides the default IndexManager from Langium to work with members imported
 * in a global scope. For that, the `ScopeComputation::computeExports` should
 * only the root namespace element as the first export
 */
export class SysMLIndexManager extends DefaultIndexManager {
    /**
     * Cache of resolved elements mapping qualified names to descriptions or
     * null if name was not found
     */
    protected readonly globalElementsCache = new Map<string, SysMLNodeDescription | null>();

    protected override readonly simpleIndex = new Map<string, SysMLNodeDescription[]>();
    protected override readonly globalScopeCache = new Map<string, SysMLNodeDescription[]>();

    /**
     * Same as {@link globalElementsCache} but for each document if building
     * with local standard library, e.g. testing TODO: store as a document
     * member
     */
    protected readonly localElementsCache = new Map<
        string,
        Map<string, SysMLNodeDescription | null>
    >();

    /**
     * Cache of full document AST
     */
    protected readonly documentNodesCache = new Map<string, AstNode[]>();

    /**
     * Map of implicit model dependencies
     */
    protected readonly modelDependencies = new Map<string, Set<string>>();

    /**
     * Index per language id
     * @see {@link simpleIndex}
     */
    protected readonly languageIndex = new Map<string, Map<string, SysMLNodeDescription[]>>();

    override allElements(nodeType = ""): Stream<SysMLNodeDescription> {
        // TODO: use getGlobalScope().getAllElements() instead

        // cannot cache global elements as they may have import statements which
        // are being resolved currently
        if (nodeType.length === 0)
            return this.getGlobalScope()
                .getAllScopes()
                .flatMap((scope) => scope.getAllElements());

        // non-empty `nodeType` may only be used after linking
        const cached = this.globalScopeCache.get(nodeType);
        if (cached) {
            return stream(cached);
        } else {
            const elements = Array.from(
                this.getGlobalScope()
                    .getAllScopes()
                    .flatMap((scope) => scope.getAllElements())
                    .filter((e) => this.astReflection.isSubtype(e.type, nodeType))
            );
            this.globalScopeCache.set(nodeType, elements);
            return stream(elements);
        }
    }

    override async updateContent(
        document: LangiumDocument,
        cancelToken = CancellationToken.None
    ): Promise<void> {
        const uri = document.uriString;

        const id = this.getLanguageId(document.uri);
        // reset caches since they will likely change, unless the document is
        // built in standalone mode
        if (!document.buildOptions?.standalone) {
            this.globalScopeCache.clear();
            this.globalElementsCache.clear();
            if (!this.languageIndex.has(id)) this.languageIndex.set(id, new Map());
            this.languageIndex.get(id)?.delete(uri);
        }

        this.modelDependencies.delete(uri);
        this.documentNodesCache.delete(uri);

        const localCache = this.localElementsCache.get(uri);
        if (localCache) {
            localCache.clear();
        } else {
            this.localElementsCache.set(uri, new Map());
        }

        const services = this.serviceRegistry.getServices(document.uri) as SysMLDefaultServices;
        document.exports = await (
            services.references.ScopeComputation as SysMLScopeComputation
        ).computeExports(
            // all root nodes are namespaces
            document as LangiumDocument<Namespace>,
            cancelToken
        );

        if (!document.buildOptions?.standalone) {
            // only exporting to global scope if the document is not standalone
            this.simpleIndex.set(uri, document.exports);
            this.languageIndex.get(id)?.set(uri, document.exports);
        }

        document.state = DocumentState.IndexedContent;
    }

    /**
     * Get currently indexed global scope. If {@link document} was provided and
     * built in standalone mode, the global scope refers to the document local
     * scope. Otherwise, the scope is constructed from all currently indexed
     * documents, optionally the scopes from matching language are prioritised
     * to resolve name clashes in SysML example files.
     * @param document document context
     * @returns the global scope
     */
    getGlobalScope(document?: LangiumDocument<Namespace>): ScopeStream {
        if (document?.buildOptions?.standalone) {
            // standalone documents use their own root scope as global scope
            return new ScopeStream([makeScope(document.parseResult.value.$meta)]);
        }

        let rootNamespaces: Stream<SysMLNodeDescription[]> = EMPTY_STREAM;

        if (document) {
            const id = this.getLanguageId(document.uri);
            if (this.languageIndex.has(id))
                rootNamespaces = stream(this.languageIndex.get(id)?.values() ?? EMPTY_STREAM);
            const otherScopes = stream(this.languageIndex.entries())
                .filter(([langId, _]) => langId !== id)
                .flatMap(([_, values]) => values.values());
            rootNamespaces = rootNamespaces.concat(otherScopes);
        } else {
            // first description in the root namespace
            rootNamespaces = stream(this.simpleIndex.values());
        }
        return new ScopeStream(
            rootNamespaces
                .map((d) => d[0].node?.$meta)
                .nonNullable()
                .map((m) => makeScope(m))
        );
    }

    /**
     * Find an element based on its fully qualified name without following
     * aliases, safe to use after computing global exports. If {@link document}
     * was provided and was built with local standard library or in standalone
     * mode, the element is resolved in the document context only.
     * @see {@link DocumentState.IndexedContent}
     * @param qualifiedName Fully qualified name relative to the global
     * namespace
     * @param document document to use for context
     * @param addDependency if true and document is provided, the document
     * owning the found element is added to the dependencies of {@link document}
     * @returns description to the element with {@link qualifiedName} or
     * undefined if not found
     */
    findGlobalElement(
        qualifiedName: string,
        document?: LangiumDocument,
        addDependency = false
    ): SysMLNodeDescription | undefined {
        const local =
            document?.buildOptions?.standardLibrary === "local" ||
            document?.buildOptions?.standalone;
        const uri = document?.uriString;
        const cache = local && uri ? this.localElementsCache.get(uri) : this.globalElementsCache;

        if (!cache) return;
        let description = cache.get(qualifiedName);
        // if not undefined, the description was found in the cache
        if (description !== undefined) return description ?? undefined;

        let parts = qualifiedName.split("::");
        let children: Map<string, MembershipMeta<ElementMeta>> | undefined;
        const root = parts[0];
        parts = parts.slice(1);
        let candidate = cache.get(root)?.node;
        if (candidate === undefined) {
            let scope: Stream<SysMLNodeDescription> = EMPTY_STREAM;

            // the first exported element is the root node itself
            if (local && uri) scope = stream(document.exports).tail(1);
            else scope = stream(this.simpleIndex.values()).flatMap((ds) => stream(ds).tail(1));
            description = scope.find((d) => d.name === root);
            cache.set(root, description ?? null);
            candidate = description?.node;
        }

        if (isElement(candidate)) {
            children = candidate.$meta.children;
        }

        // traverse the name chain
        for (const part of parts) {
            let child: ElementMeta | undefined = children?.get(part);
            if (child?.is(Membership)) child = child.element();
            description = child?.description;
            if (!description || !description.node) break;
            children = description.node.$meta.children;
        }

        // cache the found element
        cache.set(qualifiedName, description ?? null);
        if (!local && uri && description && addDependency) {
            let deps = this.modelDependencies.get(uri);
            if (!deps) {
                deps = new Set();
                this.modelDependencies.set(uri, deps);
            }
            deps.add(description.documentUri.toString());
        }

        return description;
    }

    /**
     * Convenience method wrapping {@link findGlobalElement} that looks for
     * {@link Type} elements only
     * @see {@link findGlobalElement}
     * @param type qualified type name or the type itself
     * @param document document to use for context
     * @param addDependency if true and document is provided, the document
     * owning the found element is added to the dependencies of {@link document}
     * @returns the found type or undefined otherwise
     */
    findType(
        type: string | TypeMeta | undefined,
        document?: LangiumDocument,
        addDependency = false
    ): TypeMeta | undefined {
        if (!type) return;
        if (typeof type !== "string") return type;
        const result = this.findGlobalElement(type, document, addDependency)?.node;
        if (result?.$meta.is(Type)) return result.$meta;
        return;
    }

    /**
     * Stream all document AST nodes
     * @param document document
     * @param reset whether to recompute the AST nodes
     * @returns Array of {@link document} AST nodes
     */
    stream(document: LangiumDocument, reset = false): AstNode[] {
        const uri = document.uri.toString();
        let nodes: AstNode[] | undefined;
        if (!reset) {
            nodes = this.documentNodesCache.get(uri);
            if (nodes) return nodes;
        }

        nodes = Array.from(streamAst(document.parseResult.value));
        this.documentNodesCache.set(uri, nodes);
        return nodes;
    }

    override remove(uris: URI[]): void {
        // clear out caches associated with the document uri
        for (const uri of uris) {
            const uriString = uri.toString();
            this.simpleIndex.delete(uriString);
            this.referenceIndex.delete(uriString);
            this.documentNodesCache.delete(uriString);
            this.modelDependencies.delete(uriString);
            this.localElementsCache.delete(uriString);
            this.languageIndex.get(this.getLanguageId(uri))?.delete(uriString);
        }
    }

    protected override isAffected(document: LangiumDocument<AstNode>, changed: URI): boolean {
        if (super.isAffected(document, changed)) return true;

        // also take model dependencies into account
        const deps = this.modelDependencies.get(document.uri.toString());
        if (!deps) return false;
        return deps.has(changed.toString());
    }

    /**
     * Get a language ID from a URI
     */
    protected getLanguageId(uri: URI): string {
        return Utils.extname(uri).toLowerCase();
    }
}
