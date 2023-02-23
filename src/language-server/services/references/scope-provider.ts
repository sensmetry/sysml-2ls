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
    DefaultScopeProvider,
    findLeafNodeAtOffset,
    getDocument,
    isLeafCstNode,
    LangiumDocument,
    ReferenceInfo,
} from "langium";
import {
    Element,
    ElementReference,
    Feature,
    isAlias,
    isConnectorEnd,
    isElementReference,
    isExpression,
    isFeature,
    isInlineExpression,
    isNamedArgument,
    isSysMLFunction,
    isType,
    Type,
    TypeReference,
} from "../../generated/ast";
import {
    CHILD_CONTENTS_OPTIONS,
    collectRedefinitions,
    DEFAULT_ALIAS_RESOLVER,
} from "../../utils/ast-util";
import {
    SysMLScope,
    makeScope,
    makeLinkingScope,
    FilteredScope,
    ScopeStream,
} from "../../utils/scopes";
import { KeysMatching } from "../../utils/common";
import { SysMLDefaultServices } from "../services";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { MetamodelBuilder } from "../shared/workspace/metamodel-builder";
import { CancellationToken } from "vscode-languageserver";
import { getPreviousNode } from "../../utils/cst-util";

type SpecializationKeys = KeysMatching<Type & Feature, Array<TypeReference>>;

// can't convert type unions to arrays so have to do it manually, however there
// is a type assertion to make sure we include all keys
const SpecializationPropertiesArray = (function <T extends SpecializationKeys[]>(...values: T): T {
    return values;
})(
    "chains",
    "conjugates",
    "differences",
    "disjoins",
    "featuredBy",
    "intersects",
    "inverseOf",
    "redefines",
    "references",
    "specializes",
    "subsets",
    "typedBy",
    "unions"
);

type DeclaredSpecializationKeys = typeof SpecializationPropertiesArray[number];

// casting and constraining to each other so that if any property is missing the
// type system will warn us, i.e. DeclaredSpecializationKeys ===
// SpecializationKeys
const SpecializationProperties = (function <T extends DeclaredSpecializationKeys>(
    values: T[]
): Set<string> {
    return new Set<string>(values);
})(SpecializationPropertiesArray as SpecializationKeys[]);

export class SysMLScopeProvider extends DefaultScopeProvider {
    protected override indexManager: SysMLIndexManager;
    protected metamodelBuilder: MetamodelBuilder;

    constructor(services: SysMLDefaultServices) {
        super(services);
        this.indexManager = services.shared.workspace.IndexManager;
        this.metamodelBuilder = services.shared.workspace.MetamodelBuilder;
    }

    override getScope(context: ReferenceInfo): SysMLScope {
        const unfiltered = this.getScopeUnfiltered(context);
        const referenceType = this.reflection.getReferenceType(context);
        return new FilteredScope(unfiltered, (desc) =>
            this.reflection.isSubtype(desc.type, referenceType)
        );
    }

    /**
     * Get a scope with all named elements so that aliases are not filtered out
     * @param context
     * @returns Scope with all named elements
     */
    getScopeUnfiltered(context: ReferenceInfo): ScopeStream {
        return makeLinkingScope(context.container, {}, this.indexManager.getGlobalScope());
    }

    /**
     * Get the scope for reference resolution
     * @param container reference owning container
     * @param index index of the reference
     * @param aliasResolver alias resolution function, a linker may use a
     * function that also links the alias to be resolved, while other services
     * may simply follow to the alias target
     * @returns scope that can be used to resolve the reference at {@link index}
     */
    getElementReferenceScope(
        container: ElementReference,
        index: number,
        aliasResolver = DEFAULT_ALIAS_RESOLVER
    ): SysMLScope | ScopeStream | undefined {
        let parent: ReturnType<typeof this.getContext>;
        if (index === 0) {
            // either not a reference or start of qualified type chain only the
            // first part in the chain can use its parent scope, every other
            // part has to use the resolved element scope skipping the reference
            // scope itself since it doesn't contain anything anyway
            const context = this.getContext(container);
            if (context === "error") return;
            if (context) {
                parent = context;
            } else {
                return this.initialScope(
                    container.$container,
                    container.$meta.document,
                    container.$containerProperty,
                    aliasResolver
                );
            }
        } else {
            // even if the reference was discarded due to the wrong type,
            // construct the reference resolution scope for completion provider
            parent = container.$meta.found.at(index - 1);
        }

        if (!parent) return;

        // not a start of the reference so it has to be resolved in the scope of
        // `parent`
        return this.localScope(
            parent,
            container.$meta.document ?? getDocument(container),
            aliasResolver
        );
    }

    /**
     * Get the scope for reference resolution of the first reference in the
     * qualified chain
     * @param owner owner of the {@link ElementReference} that the reference is
     * a part of
     * @param document document that contains {@link owner}
     * @param property property that {@link ElementReference} is assigned to
     * @param aliasResolver alias resolution function
     * @see {@link getElementReferenceScope} (`index === 0`)
     * @returns scope that can be used to resolve the first reference in
     * {@link ElementReference}
     */
    initialScope(
        owner: AstNode | undefined,
        document?: LangiumDocument,
        property?: string,
        aliasResolver = DEFAULT_ALIAS_RESOLVER
    ): ScopeStream | undefined {
        while (isInlineExpression(owner)) {
            // unwrap all the expressions to get the real parent
            owner = owner.$container;
        }

        let redefinitions: Set<AstNode> | undefined = undefined;
        let parent: AstNode | undefined;
        if (isType(owner)) {
            // also skip the first scoping node as references are always a part
            // of its declaration. However SysML adds more references that are
            // not used for scope resolution therefore we only skip if the
            // reference declares a specialization
            if (property && SpecializationProperties.has(property)) {
                parent = owner.$container;
            } else {
                parent = owner;
            }

            if (isFeature(owner)) {
                redefinitions = new Set();
                // collect redefinitions for hiding redefined elements
                collectRedefinitions(owner, redefinitions);

                // connector ends cannot reference connector scope
                if (isConnectorEnd(owner)) {
                    parent = owner.$container.$container;
                }
            }
        } else if (isAlias(owner)) {
            // skip the alias scope since resolution tries to follow aliases to
            // their final destination
            parent = owner.$container;
        } else {
            parent = owner;
        }

        if (!parent) return;

        // skipping the the owning node to avoid name resolution bugs if the
        // node has the same name as the reference
        try {
            document ??= getDocument(parent);
        } catch {
            // doesn't matter if no document was found
        }

        if (document) this.initializeParents(parent, document);
        return makeLinkingScope(
            parent,
            {
                aliasResolver: aliasResolver,
                // TODO: not sure if this is right and specializations are
                // allowed to reference the declaring element but this fixes a
                // linking error in
                // SysML-v2-Release/sysml/src/examples/Individuals%20Examples/JohnIndividualExample.sysml
                skip: property === "subsets" || property === "inverseOf" ? undefined : owner,
                visited: redefinitions,
            },
            this.indexManager.getGlobalScope(document)
        );
    }

    /**
     * Get the scope that can be used for reference resolution in the context of
     * {@link node}
     * @param node AST node to get scope for
     * @param document document that contains {@link node}
     * @param aliasResolver alias resolution function
     * @see {@link getElementReferenceScope} (`index > 0`)
     * @returns scope of publicly visible elements from {@link node} scope
     */
    localScope(
        node: AstNode,
        document: LangiumDocument,
        aliasResolver = DEFAULT_ALIAS_RESOLVER
    ): SysMLScope {
        this.metamodelBuilder.preLink(node, document, CancellationToken.None);
        return makeScope(node, {
            ...CHILD_CONTENTS_OPTIONS,
            aliasResolver: aliasResolver,
        });
    }

    /**
     * Get node final reference target
     * @param node
     * @returns Element referenced by `node` if linked, `"error"` if failed to link
     * and `undefined` for no reference
     */
    protected getElementTarget(node: AstNode): Element | undefined | "error" {
        if (isElementReference(node)) {
            return node.$meta.to.target ?? "error";
        } else if (isInlineExpression(node) || isExpression(node) || isSysMLFunction(node)) {
            const target = node.$meta.returnType();
            return this.indexManager.findType(target) ?? "error";
        }

        return undefined;
    }

    /**
     * Get context for scope resolution
     * @param ref Reference to resolve context for
     * @returns `undefined` if implicit parent context, `"error"` if context failed to
     * be linked and {@link Element} for existing context
     */
    protected getContext(ref: ElementReference): Element | undefined | "error" {
        const cst = ref.$cstNode;
        if (!cst) return;

        // check if the previous CST node is a scope token (`::` or `.`)
        const previous = getPreviousNode(cst, false);
        if (!previous || ![".", "::"].includes(previous.text)) {
            const owner = ref.$container;
            if (isNamedArgument(owner) && owner.$container.type) {
                return owner.$container.type.$meta.to.target ?? "error";
            }
            return;
        }

        // if it is, traverse one CST node backward again and find the reference node
        let contextCst = getPreviousNode(previous, false);
        if (!contextCst) return;
        // need to use leaf in case the found node is composite and only
        // contains the single reference node inside
        if (!isLeafCstNode(contextCst)) {
            contextCst = findLeafNodeAtOffset(contextCst, contextCst.end);
        }
        const element = contextCst?.element;
        if (!element) return;
        return this.getElementTarget(element);
    }

    /**
     * Construct parent nodes of {@link node}, including itself, for scope
     * resolution
     * @param node AST node that scope is being constructed for
     * @param document document that contains {@link node}
     */
    protected initializeParents(node: AstNode | undefined, document: LangiumDocument): void {
        while (node) {
            this.metamodelBuilder.preLink(node, document, CancellationToken.None);
            node = node.$container;
        }
    }
}
