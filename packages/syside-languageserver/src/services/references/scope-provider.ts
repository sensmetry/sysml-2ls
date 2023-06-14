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
    DefaultScopeProvider,
    findLeafNodeAtOffset,
    isLeafCstNode,
    LangiumDocument,
    ReferenceInfo,
} from "langium";
import {
    Conjugation,
    Element,
    ElementReference,
    EndFeatureMembership,
    Expression,
    FeatureChaining,
    FeatureInverting,
    InlineExpression,
    InvocationExpression,
    Membership,
    Namespace,
    ParameterMembership,
    Specialization,
    Subsetting,
    SysMLFunction,
} from "../../generated/ast";
import {
    CHILD_CONTENTS_OPTIONS,
    DEFAULT_ALIAS_RESOLVER,
    ScopeOptions,
} from "../../utils/scope-util";
import {
    SysMLScope,
    makeScope,
    makeLinkingScope,
    FilteredScope,
    ScopeStream,
} from "../../utils/scopes";
import { SysMLDefaultServices } from "../services";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { MetamodelBuilder } from "../shared/workspace/metamodel-builder";
import { CancellationToken } from "vscode-languageserver";
import { getPreviousNode } from "../../utils/cst-util";
import { ElementMeta, ElementReferenceMeta, FeatureMeta, Metamodel } from "../../model";
import { SysMLType } from "../sysml-ast-reflection";

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
        return new FilteredScope(
            unfiltered,
            (desc) => !!desc.element()?.is(referenceType as SysMLType)
        );
    }

    /**
     * Get a scope with all named elements so that aliases are not filtered out
     * @param context
     * @returns Scope with all named elements
     */
    getScopeUnfiltered(context: ReferenceInfo): ScopeStream {
        return makeLinkingScope(context.container.$meta, {}, this.indexManager.getGlobalScope());
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
        container: ElementReferenceMeta,
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
                return this.initialScope(container.owner(), container.document, { aliasResolver });
            }
        } else {
            // even if the reference was discarded due to the wrong type,
            // construct the reference resolution scope for completion provider
            parent = container.found.at(index - 1);
        }

        if (!parent) return;

        // not a start of the reference so it has to be resolved in the scope of
        // `parent`
        return this.localScope(parent, container.document, aliasResolver);
    }

    /**
     * Get the scope for reference resolution of the first reference in the
     * qualified chain
     * @param owner owner of the {@link ElementReference} that the reference is
     * a part of
     * @param document document that contains {@link owner}
     * @param aliasResolver alias resolution function
     * @see {@link getElementReferenceScope} (`index === 0`)
     * @returns scope that can be used to resolve the first reference in
     * {@link ElementReference}
     */
    initialScope(
        owner: Metamodel | undefined,
        document?: LangiumDocument,
        options?: ScopeOptions
    ): SysMLScope | undefined {
        options ??= { aliasResolver: DEFAULT_ALIAS_RESOLVER };
        while (owner?.is(InlineExpression)) {
            // unwrap all the expressions to get the real parent
            owner = owner.owner();
        }

        // need to unwrap feature chaining
        if (owner?.is(FeatureChaining)) {
            // if using `chains` notation, two levels up will be the feature
            // owner, otherwise 2 levels up is a type relationship which will be
            // handled by the next statement
            owner = owner.owner()?.owner();
        }

        // also skip the first scoping node as references are always a part
        // of its declaration. However SysML adds more references that are
        // not used for scope resolution therefore we only skip if the
        // reference declares a specialization
        if (owner?.isAny(Specialization, Conjugation)) {
            // TODO: not sure if this is right and specializations are
            // allowed to reference the declaring element but this fixes a
            // linking error in
            // SysML-v2-Release/sysml/src/examples/Individuals%20Examples/JohnIndividualExample.sysml
            if (owner.nodeType() !== Subsetting && owner.nodeType() !== FeatureInverting) {
                options.skip = owner.source();
            }

            const parent = owner.parent();
            if (parent?.parent()?.is(ParameterMembership)) {
                const outer = parent.owner();
                if (outer?.is(InvocationExpression) && (parent as FeatureMeta).value)
                    // resolution of type relationships in an invocation
                    // argument should be done in the invoked function scope
                    return this.localScope(
                        outer.invokes() ?? outer,
                        undefined,
                        options.aliasResolver
                    );
            }

            // source == parent if this relationship is a part of declaration,
            // in that case skip the owner since specialization itself makes no
            // sense
            owner = owner.source() === parent ? parent?.owner() : parent;

            if (options.skip?.parent()?.is(EndFeatureMembership)) {
                // connector ends cannot reference connector scope
                owner = owner?.owner();
            }
        } else if (owner?.parent()?.is(ParameterMembership)) {
            if (owner.owner()?.is(InvocationExpression)) {
                // invocation argument
                return this.initialScope(owner.owner(), document, options);
            }
        } else if (owner?.is(Membership)) {
            // skip the alias scope since resolution tries to follow aliases to
            // their final destination
            owner = owner.owner();
        }

        if (!owner) return;

        // skipping the the owning node to avoid name resolution bugs if the
        // node has the same name as the reference
        document ??= owner.document;

        const parent = owner.is(Element) ? owner : (owner.parent() as ElementMeta | undefined);
        if (parent) this.initializeParents(parent, document);

        return makeLinkingScope(
            owner,
            options,
            this.indexManager.getGlobalScope(document as LangiumDocument<Namespace> | undefined)
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
        node: Metamodel,
        document?: LangiumDocument,
        aliasResolver = DEFAULT_ALIAS_RESOLVER
    ): SysMLScope {
        const ast = node.ast();
        if (ast && document) this.metamodelBuilder.preLink(ast, document, CancellationToken.None);
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
    protected getElementTarget(node: Metamodel): ElementMeta | undefined | "error" {
        if (node.is(ElementReference)) {
            return node.to.target ?? "error";
        } else if (node.isAny(InlineExpression, Expression, SysMLFunction)) {
            const target = node.returnType();
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
    protected getContext(ref: ElementReferenceMeta): ElementMeta | undefined | "error" {
        const ast = ref.ast();
        if (!ast) return;
        const cst = ast.$cstNode;
        if (!cst) return;

        // check if the previous CST node is a scope token (`::` or `.`)
        let previous = getPreviousNode(cst, false);
        if (previous && !isLeafCstNode(previous)) {
            previous = findLeafNodeAtOffset(previous, previous.end);
        }
        if (!previous || ![".", "::"].includes(previous.text)) {
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
        if (!element?.$meta) return;
        return this.getElementTarget(element.$meta);
    }

    /**
     * Construct parent nodes of {@link node}, including itself, for scope
     * resolution
     * @param node AST node that scope is being constructed for
     * @param document document that contains {@link node}
     */
    protected initializeParents(node: ElementMeta | undefined, document: LangiumDocument): void {
        while (node) {
            this.metamodelBuilder.buildElement(node, document);
            node = node.parent();
        }
    }
}
