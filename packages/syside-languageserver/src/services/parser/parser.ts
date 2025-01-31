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

import {
    AstNode,
    CstNode,
    isAstNode,
    LangiumParser,
    Mutable,
    streamContents,
    streamCst,
} from "langium";
import { createParser } from "langium/lib/parser/parser-builder-base";
import { CstNodeBuilder } from "langium/lib/parser/cst-node-builder";
import {
    EndFeatureMembership,
    Expose,
    Feature,
    FeatureReferenceExpression,
    Import,
    MembershipExpose,
    MembershipImport,
    MembershipReference,
    NamespaceExpose,
    NamespaceImport,
    NamespaceReference,
    OperatorExpression,
    Package,
    ParameterMembership,
    ReferenceUsage,
    ReturnParameterMembership,
    SuccessionAsUsage,
    TransitionUsage,
    Usage,
    WhileLoopActionUsage,
} from "../../generated/ast";
import { typeIndex, TypeMap } from "../../model/types";
import { SysMLDefaultServices } from "../services";
import { compareRanges } from "../../utils/ast-util";
import { isRuleCall } from "langium/lib/grammar/generated/ast";
import { SysMLType, SysMLTypeList } from "../sysml-ast-reflection";
import { erase } from "../../utils/common";

const ClassificationTestOperator = ["istype", "hastype", "@", "as"];

/**
 * The grammar rules that calls `SelfReferenceExpression` rule breaks parsing
 * with Langium, resolve it here.
 */
function fixOperatorExpression(expr: OperatorExpression, services: SysMLDefaultServices): void {
    if (!expr.operands) expr.operands = [];
    if (
        expr.operands.length === 0 &&
        expr.operator &&
        ClassificationTestOperator.includes(expr.operator)
    ) {
        const reflection = services.shared.AstReflection;
        const expression = reflection.createNode(FeatureReferenceExpression, {
            $container: expr,
            $containerProperty: "operands",
            $containerIndex: 0,
        });

        const member = reflection.createNode(ReturnParameterMembership, {
            $container: expression,
            $containerProperty: "expression",
        });

        reflection.createNode(Feature, {
            $container: member,
            $containerProperty: "target",
        });
    }
}

function addLoopMember(node: WhileLoopActionUsage, services: SysMLDefaultServices): void {
    if (!node.condition) {
        const reflection = services.shared.AstReflection;
        const membership = reflection.createNode(ParameterMembership, {
            $container: node,
            $containerProperty: "condition",
        });

        reflection.createNode(Usage, {
            $container: membership,
            $containerProperty: "target",
        });
    }
}

function finalizeImport(node: Import, services: SysMLDefaultServices): void {
    const type: string = node.$type;
    if (type !== Import && type !== Expose) return;
    if (node.isNamespace || node.target) {
        if (node.targetRef) {
            (node.targetRef as Mutable<AstNode>).$type = node.isNamespace
                ? NamespaceReference
                : MembershipReference;
        }
        (node as Mutable<Import>).$type = type === Expose ? NamespaceExpose : NamespaceImport;
        if (node.target && node.targetRef) {
            // need to reparent `node.reference`
            const pack = node.target as Package;
            const imp = services.shared.AstReflection.createNode(
                node.isNamespace ? NamespaceImport : MembershipImport,
                {
                    $container: pack,
                    $containerProperty: "children",
                    $containerIndex: 0,
                    isRecursive: node.isRecursive,
                }
            );
            services.shared.AstReflection.assignNode(node.targetRef, {
                $container: imp,
                $containerProperty: "targetRef",
            });
            erase(node.$children, node.targetRef);
            delete node.targetRef;
        }

        // remove unneeded property
        delete node.isNamespace;
    } else {
        if (node.targetRef) (node.targetRef as Mutable<AstNode>).$type = MembershipReference;
        (node as Mutable<Import>).$type = type === Expose ? MembershipExpose : MembershipImport;
    }
}

// This only exists since Langium doesn't allow linking to elements without AST
// nodes (╯°□°)╯︵ ┻━┻
function createEmptyParametersInTransitionUsage(
    node: TransitionUsage,
    services: SysMLDefaultServices
): void {
    const reflection = services.shared.AstReflection;
    {
        const membership = reflection.createNode(ParameterMembership, {
            $container: node,
            $containerProperty: "transitionLinkSource",
        });

        reflection.createNode(ReferenceUsage, {
            $container: membership,
            $containerProperty: "target",
        });
    }

    if (!node.accepter) return;
    {
        const membership = reflection.createNode(ParameterMembership, {
            $container: node,
            $containerProperty: "payload",
        });

        reflection.createNode(ReferenceUsage, {
            $container: membership,
            $containerProperty: "target",
        });
    }
}

function createMissingEndsInSuccessionAsUsage(
    node: SuccessionAsUsage,
    services: SysMLDefaultServices
): void {
    // `ends` may not have been created yet so it may be undefined
    node.ends ??= [];
    const ends = node.ends.length;
    if (ends >= 2) return;

    const reflection = services.shared.AstReflection;
    // NB: adding CST nodes to the owning element for better validation
    // locations

    let insert = [0, 1];
    // ends === 0 or ends === undefined -> EmptySuccessionMember rule
    // ends === 1 -> missing empty MultiplicitySourceEndMember
    if (ends === 1) {
        if ((node.ends[0].target as Feature).multiplicity) insert = [1];
        else insert = [0];
    }
    for (const index of insert) {
        const member = reflection.createNode(EndFeatureMembership, {
            $container: node,
            $containerProperty: "ends",
            $containerIndex: index,
            $cstNode: node.$cstNode,
        });
        reflection.createNode(Feature, {
            $container: member,
            $containerProperty: "target",
            $cstNode: node.$cstNode,
        });
    }
}

type ProcessingFunction<T extends AstNode = AstNode> = (
    node: T,
    services: SysMLDefaultServices
) => void;
type ProcessingMap = { [K in SysMLType]?: ProcessingFunction<SysMLTypeList[K]> };

/**
 * Extension of Langium CST node builder that performs some postprocessing on
 * the parsed AST nodes.
 */
export class SysMLCstNodeBuilder extends CstNodeBuilder {
    protected readonly postprocessingMap;
    protected readonly services: SysMLDefaultServices;

    constructor(services: SysMLDefaultServices) {
        super();

        this.services = services;

        // map to postprocess specific AST node types after parsing
        const map: ProcessingMap = {
            OperatorExpression: fixOperatorExpression,
            WhileLoopActionUsage: addLoopMember,
            Import: finalizeImport,
            TransitionUsage: createEmptyParametersInTransitionUsage,
            SuccessionAsUsage: createMissingEndsInSuccessionAsUsage,
        };

        this.postprocessingMap = typeIndex.expandToDerivedTypes(
            map as TypeMap<SysMLTypeList, ProcessingFunction>
        );
    }

    override construct(item: { $type: string | symbol | undefined; $cstNode: CstNode }): void {
        super.construct(item);
        if (typeof item.$type === "string") {
            this.postprocessingMap.get(item.$type)?.call(undefined, item as AstNode, this.services);
        }
    }
}

interface MutableLangiumParser extends Mutable<LangiumParser> {
    nodeBuilder: CstNodeBuilder;
}

/**
 * Collect and cache children AST nodes
 * @param node Node to collect children nodes for
 */
function collectChildren(node: AstNode): void {
    node.$children.length = 0;
    node.$children.push(...streamContents(node).toArray());
    node.$children.sort((a, b) => compareRanges(a.$cstNode?.range, b.$cstNode?.range));
    node.$children.forEach((child, index) => ((child as Mutable<AstNode>).$childIndex = index));
}

export class SysMLParser extends LangiumParser {
    constructor(services: SysMLDefaultServices) {
        super(services);
        (this as unknown as MutableLangiumParser).nodeBuilder = new SysMLCstNodeBuilder(services);
    }

    fillNode(node: { $type: string }): void {
        super["assignMandatoryProperties"](node);
        if (isAstNode(node)) collectChildren(node);
    }

    override construct(pop?: boolean | undefined): unknown {
        const value = super.construct(pop);
        if (isAstNode(value)) collectChildren(value);
        return value;
    }
}

/**
 * Create and finalize a Langium parser. The parser rules are derived from the
 * grammar, which is available at `services.Grammar`.
 */
export function createSysMLParser(services: SysMLDefaultServices): SysMLParser {
    const parser = prepareSysMLParser(services);
    parser.finalize();
    return parser;
}

/**
 * Create a Langium parser without finalizing it. This is used to extract more
 * detailed error information when the parser is initially validated.
 */
export function prepareSysMLParser(services: SysMLDefaultServices): SysMLParser {
    const grammar = services.Grammar;
    const lexer = services.parser.Lexer;
    const parser = new SysMLParser(services);
    return createParser(grammar, parser, lexer.definition);
}

declare module "../../generated/ast" {
    interface ElementReference {
        text?: string;
    }
}

declare module "langium" {
    interface AstNode {
        /**
         * Direct children of this AST node
         */
        readonly $children: AstNode[];

        /**
         * Index of this AST node in parent {@link $children} container
         */
        readonly $childIndex: number;
    }
}

// TODO: temporary patch until we can update Langium with https://github.com/langium/langium/pull/898
LangiumParser.prototype["assignWithoutOverride"] = function (
    target: Record<string, unknown> & { $cstNode: CstNode },
    source: object & { $type?: string; $cstNode?: CstNode }
): Record<string, unknown> {
    const hasType = target.$type !== undefined;

    for (const [name, existingValue] of Object.entries(source)) {
        const newValue = target[name];
        if (newValue === undefined) {
            target[name] = existingValue;
        } else if (Array.isArray(newValue) && Array.isArray(existingValue)) {
            existingValue.push(...newValue);
            target[name] = existingValue;
        }
    }

    if (!hasType && source.$type) {
        // there seems to be a parser bug where very rarely the target won't
        // have mandatory properties assigned after setting $type
        this["assignMandatoryProperties"](target);
        collectChildren(target as unknown as AstNode);
    }

    if (source.$cstNode) {
        const feature = source.$cstNode.feature;
        if (isRuleCall(feature) && feature.rule.ref && !feature.rule.ref.fragment) {
            // Merging `source` from a subrule into target, need to update the
            // source and its children CST nodes to point to the merged AST node
            // instead.
            const iterator = streamCst(source.$cstNode).iterator();

            let current = iterator.next();
            while (!current.done) {
                const node = current.value;
                if (node.element === source) {
                    // only need to update the matching element which is
                    // currently being merged and skip any other children
                    Object.defineProperty(node, "element", {
                        get() {
                            // lazy getter to handle cases where this subrule
                            // multiple layers deep
                            return target.$cstNode.element ?? target;
                        },
                        set(element: object) {
                            Object.defineProperty(node, "element", element);
                        },
                        configurable: true,
                    });
                } else {
                    iterator.prune();
                }

                current = iterator.next();
            }
        }
    }

    return target;
};
