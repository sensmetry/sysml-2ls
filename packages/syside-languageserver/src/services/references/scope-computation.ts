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
    DefaultScopeComputation,
    interruptAndCheck,
    LangiumDocument,
    MultiMap,
    stream,
} from "langium";
import { CancellationToken } from "vscode-languageserver";
import {
    isTransparentElement,
    isLibraryPackage,
    isElement,
    Element,
    Membership,
    isMembership,
} from "../../generated/ast";
import { MembershipMeta } from "../../model";
import { SysMLDefaultServices } from "../services";
import {
    SysMLNodeDescription,
    SysMLNodeDescriptionProvider,
} from "../shared/workspace/ast-descriptions";

export class SysMLScopeComputation extends DefaultScopeComputation {
    protected override readonly descriptions: SysMLNodeDescriptionProvider;

    constructor(services: SysMLDefaultServices) {
        super(services);
        this.descriptions = services.workspace.AstNodeDescriptionProvider;
    }

    /**
     * Compute global scope exports as {@link SysMLIndexManager} expects
     * @param document document to compute exports for
     * @param cancelToken optional cancellation token
     * @returns An array of exported elements with the first element to the root
     * namespace
     */
    override async computeExports(
        document: LangiumDocument<Element>,
        cancelToken = CancellationToken.None
    ): Promise<SysMLNodeDescription[]> {
        const exports = [
            this.descriptions.createDescription(document.parseResult.value, "", document),
        ];

        // only exporting the direct children, traverse the tree to find other
        // elements
        for (const node of document.parseResult.value.$children) {
            await interruptAndCheck(cancelToken);
            if (isMembership(node)) {
                exports.push(this.createDescription(node.element ?? node, document));
            }
        }

        return exports;
    }

    /**
     * Compute node local exports
     * @param document document to compute local exports for
     * @param cancelToken optional cancellation token
     * @returns MultiMap of AstNode exported children
     */
    override async computeLocalScopes(
        document: LangiumDocument,
        cancelToken = CancellationToken.None
    ): Promise<MultiMap<AstNode, SysMLNodeDescription>> {
        const model = document.parseResult.value;
        const scopes = new MultiMap<AstNode, SysMLNodeDescription>();
        await this.processContainer(model, scopes, document, false, cancelToken);
        return scopes;
    }

    /**
     * Recursively compute local exports
     * @param container current root AST node
     * @param scopes already computes local exports
     * @param document document that contains {@link container}
     * @param isStandardElement if true, {@link container} is owned by a
     * standard library package at any parent level
     * @param cancelToken cancellation token
     * @returns descriptions of exported elements by {@link container}
     */
    protected async processContainer(
        container: AstNode,
        scopes: MultiMap<AstNode, SysMLNodeDescription>,
        document: LangiumDocument,
        isStandardElement: boolean,
        cancelToken: CancellationToken
    ): Promise<MembershipMeta[]> {
        const localExports: MembershipMeta[] = [];

        // since this is called recursively, propagate isStandardElement
        isStandardElement ||= isLibraryPackage(container) && container.isStandard;
        const meta = container.$meta;
        if (meta) meta.isStandardElement = isStandardElement;

        for (const element of container.$children) {
            await interruptAndCheck(cancelToken);

            const children = await this.processContainer(
                element,
                scopes,
                document,
                isStandardElement,
                cancelToken
            );
            const extra = this.additionalExports(element, children);
            if (extra) localExports.push(...extra);

            if (!isElement(element)) continue;
            this.createDescription(element, document);

            if (element.$meta.is(Membership)) localExports.push(element.$meta);
        }
        scopes.addAll(
            container,
            stream(localExports)
                .map((m) => m.element()?.description)
                .nonNullable()
        );

        if (isElement(container)) {
            // update scope lookup table with the exports
            const meta = container.$meta;
            for (const member of localExports) {
                meta["addLookupMember"](member);
            }
        }

        return localExports;
    }

    /**
     * Construct export descriptions for {@link node}
     */
    protected createDescription(node: Element, document: LangiumDocument): SysMLNodeDescription {
        const regular = this.descriptions.createDescription(
            node,
            node.$meta.name ?? node.$meta.shortName ?? `${node.$meta.elementId}`,
            document
        );
        node.$meta["_description"] = regular;

        return regular;
    }

    /**
     * Compute additional exports to the parent scope
     * @param element child element
     * @param exports descriptions exported by {@link element}
     * @returns additionally exported element descriptions by {@link element} to
     * its parent scope
     */
    protected additionalExports(
        element: AstNode,
        exports: MembershipMeta[]
    ): Iterable<MembershipMeta> | undefined {
        // transparent elements export their scopes to parents
        if (isTransparentElement(element)) return exports;
        return;
    }
}
