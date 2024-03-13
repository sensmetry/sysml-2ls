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
    AcceptActionUsage,
    AssignmentActionUsage,
    ControlNode,
    DecisionNode,
    Expression,
    FeatureTyping,
    ForkNode,
    IfActionUsage,
    OwningMembership,
    PerformActionUsage,
    SendActionUsage,
    SuccessionAsUsage,
    TransitionUsage,
} from "../../generated/ast";
import {
    Doc,
    KeysMatching,
    NonNullable,
    brackets,
    group,
    hardline,
    ifBreak,
    indent,
    indentIfBreak,
    keyword,
    line,
    literals,
    softline,
    text,
} from "../../utils";
import {
    ElementMeta,
    ExpressionMeta,
    FeatureMeta,
    OPERATORS,
    OwningMembershipMeta,
    ParameterMembershipMeta,
    ResultExpressionMembershipMeta,
} from "../KerML";
import {
    AcceptActionUsageMeta,
    ActionUsageMeta,
    AssignmentActionUsageMeta,
    ControlNodeMeta,
    ForLoopActionUsageMeta,
    IfActionUsageMeta,
    PerformActionUsageMeta,
    SendActionUsageMeta,
    StateDefinitionMeta,
    StateSubactionMembershipMeta,
    StateUsageMeta,
    SuccessionAsUsageMeta,
    TransitionUsageMeta,
    WhileLoopActionUsageMeta,
} from "../SysML";
import {
    occurrenceUsageModifiers,
    printGenericOccurrenceDefinition,
    printGenericOccurrenceUsage,
    printPerformAction,
} from "./definition-usages";
import {
    printAsTarget,
    printAssignmentExpression,
    printChaining,
    printTarget,
    printWithVisibility,
} from "./edges";
import { getOperator } from "./expressions";
import {
    ChildrenJoiner,
    featureValueAppender,
    printChildrenBlock,
    printGenericFeature,
    printGenericNamespace,
} from "./namespaces";
import {
    DefaultElementPrinter,
    ModelPrinterContext,
    assertSysML,
    printModelElement,
} from "./print";
import { successionAsUsageKind } from "./successions";
import { assertMember, printDescendant, selectDeclarationKeyword, throwError } from "./utils";

function printNodeParameter<
    T extends ElementMeta,
    K extends string & KeysMatching<T, ParameterMembershipMeta | undefined>,
>(node: T, prop: K, context: ModelPrinterContext, kind = "node parameter"): Doc {
    return printDescendant(node, context, kind)
        .descend((node) => node[prop] as ParameterMembershipMeta | undefined)
        .descend((param) => param.element())
        .descend((target) => target.value)
        .descend((fv) => fv.element())
        .print();
}

function printPayloadParameter<
    T extends ElementMeta,
    K extends KeysMatching<T, ParameterMembershipMeta | undefined>,
>(node: T, prop: K, context: ModelPrinterContext, kind = "payload parameter"): Doc {
    return printDescendant(node, context, kind)
        .descend((node) => node[prop] as ParameterMembershipMeta | undefined)
        .descend((member) => member.element())
        .print({
            printer(param, context) {
                return printGenericNamespace(param, context, {
                    modifiers: [],
                    keyword: undefined,
                    skipChildren: true,
                    skipFirstSpecializationKeyword: Boolean(
                        !param.declaredName &&
                            !param.declaredShortName &&
                            param.specializations().filter((s) => !s.isImplied).length === 1 &&
                            param
                                .specializations()
                                .find((s) => !s.isImplied)
                                ?.is(FeatureTyping) &&
                            !param.value
                    ),
                    appendToDeclaration: featureValueAppender(param, context),
                });
            },
        });
}

function printActionSubtype(
    node: ActionUsageMeta,
    context: ModelPrinterContext,
    options: {
        suffix: Doc;
        keyword: string;
        declarationOnly?: boolean;
    }
): Doc {
    return printGenericOccurrenceUsage(
        options.declarationOnly ? [] : "auto",
        selectDeclarationKeyword(node, "action", context.format.action_node_keyword),
        node,
        context,
        {
            appendToDeclaration(declaration) {
                const suffix = group([
                    keyword(options.keyword),
                    literals.space,
                    group(options.suffix),
                ]);
                if (declaration.length > 0)
                    declaration.push(
                        group(
                            [
                                indent(line),
                                indentIfBreak(suffix, { groupId: "action-subtype-suffix" }),
                            ],
                            {
                                id: "action-subtype-suffix",
                            }
                        )
                    );
                else declaration.push(suffix);
            },
            skipChildren: options.declarationOnly,
            join: actionBodyJoiner(),
        }
    );
}

export function printAssignmentAction(
    node: AssignmentActionUsageMeta,
    context: ModelPrinterContext,
    declarationOnly?: boolean
): Doc {
    const suffix: Doc[] = [];

    // langium cannot parse this but adding here for completeness
    const target = node.target?.element()?.value?.element();
    if (target)
        suffix.push(
            printDescendant(node, context, "assignment action target")
                .descend((node) => node.target)
                .descend((node) => node.element())
                .descend((node) => node.value)
                .descend((node) => node.element())
                .print(),
            indent([softline, literals.dot])
        );

    /* istanbul ignore next */
    if (!node.targetMember) throwError(node, "Invalid assignment action - missing target member");
    suffix.push(
        printAsTarget(node.targetMember, context, {
            printer(node, context) {
                if (node.parent()?.is(OwningMembership))
                    return indent(printChaining(node, context));
                return DefaultElementPrinter(node, context);
            },
        })
    );

    assertMember(node, node.assignedValue, "assignment action", "assigned value");
    suffix.push(
        printAssignmentExpression(
            [literals.space, text(":=")],
            node.assignedValue?.element().value?.element(),
            context,
            printNodeParameter(node, "assignedValue", context, "assigned value")
        )
    );

    return printActionSubtype(node, context, {
        suffix,
        keyword: "assign",
        declarationOnly,
    });
}

export function printAccepterParameterPart(
    node: AcceptActionUsageMeta,
    context: ModelPrinterContext
): Doc {
    const suffix: Doc[] = [printPayloadParameter(node, "payload", context)];
    if (!node.receiver.isImplied)
        suffix.push(
            indent([
                line,
                keyword("via "),
                printNodeParameter(node, "receiver", context, "receiver"),
            ])
        );

    return suffix;
}

export function printAcceptActionUsage(
    node: AcceptActionUsageMeta,
    context: ModelPrinterContext,
    declarationOnly?: boolean
): Doc {
    return printActionSubtype(node, context, {
        suffix: printAccepterParameterPart(node, context),
        keyword: "accept",
        declarationOnly,
    });
}

export function printControlNode(
    kw: string,
    node: ControlNodeMeta,
    context: ModelPrinterContext
): Doc {
    assertSysML(context, node.nodeType());
    const modifiers = occurrenceUsageModifiers(node);

    return printGenericFeature(modifiers, kw, node, context, {
        join: actionBodyJoiner(),
        appendToDeclaration: featureValueAppender(node, context),
    });
}

function printControlFlow(
    node: ActionUsageMeta,
    context: ModelPrinterContext,
    options: {
        suffix: Doc;
    }
): Doc {
    return printGenericOccurrenceUsage(
        "auto",
        selectDeclarationKeyword(node, "action", context.format.action_node_keyword),
        node,
        context,
        {
            appendToDeclaration(declaration) {
                if (declaration.length > 0) declaration.push(line);
                declaration.push(options.suffix);
            },
            skipChildren: true,
        }
    );
}

function printActionBodyParameter<
    T extends FeatureMeta,
    K extends KeysMatching<T, ParameterMembershipMeta | undefined>,
>(
    node: T,
    prop: K,
    context: ModelPrinterContext,
    options: {
        mustBreak: boolean;
        kind: string;
    }
): Doc[] {
    return printDescendant(node, context, options.kind)
        .descend((node) => node[prop] as ParameterMembershipMeta | undefined)
        .descend((member) => member.element())
        .print({
            printer(param, context) {
                const kw = selectDeclarationKeyword(
                    param,
                    "action",
                    context.format.action_node_keyword
                );

                let body = printGenericFeature([], kw, param, context, {
                    forceBrackets: true,
                    appendToDeclaration() {
                        /* empty */
                    },
                    forceBreakChildren: options.mustBreak,
                    join: actionBodyJoiner(),
                });
                if (options.mustBreak) body = ifBreak(body, group(body));

                // don't want to indent the body itself
                if (kw) {
                    return [indent(line), body];
                }

                return [literals.space, body];
            },
        });
}

export function printCondition(
    kw: Doc,
    edge: OwningMembershipMeta<ExpressionMeta> | FeatureMeta,
    context: ModelPrinterContext,
    parenthesize: "always" | "never" | "on_break"
): Doc {
    let expr: Doc;
    let target: FeatureMeta;
    if (edge.is(OwningMembership)) {
        expr = printTarget(edge, context);
        target = edge.element();
    } else {
        expr = printModelElement(edge, context);
        target = edge;
    }

    if (getOperator(target) === OPERATORS.COMMA) parenthesize = "never";

    if (parenthesize === "always") {
        expr = group([
            brackets.round.open,
            indent([softline, expr]),
            softline,
            brackets.round.close,
        ]);
    } else if (parenthesize === "on_break") {
        expr = group([
            ifBreak(brackets.round.open, literals.emptytext),
            indent([softline, expr]),
            softline,
            ifBreak(brackets.round.close, literals.emptytext),
        ]);
    }

    if (parenthesize !== "never") {
        return [
            kw,
            group(indent(line), { id: "condition" }),
            indentIfBreak(expr, { groupId: "condition" }),
        ];
    }

    return printAssignmentExpression([kw], target, context, expr);
}

export function printWhileLoop(node: WhileLoopActionUsageMeta, context: ModelPrinterContext): Doc {
    const suffix: Doc[] = [];

    const body = printActionBodyParameter(node, "body", context, {
        kind: "while loop body parameter",
        mustBreak: node.until !== undefined,
    });
    if (!node.condition || !node.condition.element()?.is(Expression)) {
        suffix.push(keyword("loop "), body[1]);
    } else {
        suffix.push(
            group(
                printCondition(
                    keyword("while"),
                    node.condition,
                    context,
                    context.format.while_loop_parenthesize_condition
                )
            ),
            body
        );
    }

    if (node.until) {
        suffix.push(
            group([
                printCondition(
                    keyword(" until"),
                    node.until,
                    context,
                    context.format.while_loop_parenthesize_until
                ),
                text(";"),
            ])
        );
    }

    return printControlFlow(node, context, { suffix: group(suffix) });
}

export function printForLoop(node: ForLoopActionUsageMeta, context: ModelPrinterContext): Doc {
    return printDescendant(node, context, "for loop")
        .descend((node) => node.variable)
        .descend((member) => member.element())
        .print({
            printer(variable, context) {
                const suffix: Doc[] = [];

                suffix.push(
                    printGenericFeature([], undefined, variable, context, {
                        appendToDeclaration() {
                            /* empty */
                        },
                        skipChildren: true,
                    }),
                    line,
                    keyword("in "),
                    printNodeParameter(node, "sequence", context, "for loop sequence")
                );

                return printControlFlow(node, context, {
                    suffix: group([
                        keyword("for "),
                        group(indent(suffix)),
                        printActionBodyParameter(node, "body", context, {
                            kind: "for loop body",
                            mustBreak: false,
                        }),
                    ]),
                });
            },
        });
}

export function printIfAction(node: IfActionUsageMeta, context: ModelPrinterContext): Doc {
    const suffix: Doc[] = [];
    const elseBranch = node.else?.element();

    /* istanbul ignore next */
    if (!node.condition) throwError(node, "Invalid if action - missing condition");
    suffix.push(
        group(
            printCondition(
                keyword("if"),
                node.condition,
                context,
                context.format.if_parenthesize_condition
            )
        ),
        printActionBodyParameter(node, "then", context, {
            kind: "if then branch",
            mustBreak: Boolean(elseBranch) || node.owner()?.nodeType() === IfActionUsage,
        })
    );

    if (elseBranch) {
        suffix.push(keyword(" else"));
        if (elseBranch.is(IfActionUsage)) {
            suffix.push(literals.space, printIfAction(elseBranch, context));
        } else {
            suffix.push(
                printActionBodyParameter(node, "else", context, {
                    kind: "if else branch",
                    mustBreak: true,
                })
            );
        }
    }

    return printControlFlow(node, context, { suffix: group(suffix) });
}

export function printSendAction(
    node: SendActionUsageMeta,
    context: ModelPrinterContext,
    declarationOnly?: boolean
): Doc {
    const suffix: Doc[] = [];
    suffix.push(printNodeParameter(node, "payload", context, "payload"));
    if (!node.sender.isImplied)
        suffix.push(indent([line, keyword("via "), printNodeParameter(node, "sender", context)]));
    if (!node.receiver.isImplied)
        suffix.push(indent([line, keyword("to "), printNodeParameter(node, "receiver", context)]));

    return printActionSubtype(node, context, {
        keyword: "send",
        suffix,
        declarationOnly,
    });
}

export function printSubaction(
    node: ActionUsageMeta & { result?: ResultExpressionMembershipMeta },
    context: ModelPrinterContext,
    semicolon: Doc = literals.semicolon
): Doc {
    const decl = ((): Doc | undefined => {
        switch (node.nodeType()) {
            case PerformActionUsage:
                return printPerformAction(node as PerformActionUsageMeta, context, true);
            case AcceptActionUsage:
                return printAcceptActionUsage(node as AcceptActionUsageMeta, context, true);
            case SendActionUsage:
                return printSendAction(node as SendActionUsageMeta, context, true);
            case AssignmentActionUsage:
                return printAssignmentAction(node as AssignmentActionUsageMeta, context, true);
            default:
                return;
        }
    })();

    if (!decl) return semicolon;

    return printModelElement(node, context, {
        printer: (node, context) =>
            group([
                decl,
                printChildrenBlock(node, node.children, context, {
                    insertSpaceBeforeBrackets: true,
                    semicolon,
                    result: node.result,
                    join: actionBodyJoiner(),
                }),
            ]),
    });
}

export function printStateSubactionMembership(
    node: StateSubactionMembershipMeta,
    context: ModelPrinterContext
): Doc {
    assertSysML(context, node.nodeType());
    const target = printModelElement(node.element(), context, {
        printer: (node, ctx) => printSubaction(node, ctx),
    });

    const contents =
        target === literals.semicolon
            ? [keyword(node.kind), literals.semicolon]
            : [keyword(node.kind), literals.space, target];

    return printWithVisibility(node, contents, context);
}

export function printStateDefinition(node: StateDefinitionMeta, context: ModelPrinterContext): Doc {
    return printGenericOccurrenceDefinition("auto", "state def", node, context, {
        appendToDeclaration(declaration) {
            if (node.isParallel) declaration.push([line, keyword("parallel")]);
        },
        forceBrackets: node.isParallel,
    });
}

export function printStateUsage(node: StateUsageMeta, context: ModelPrinterContext): Doc {
    return printGenericOccurrenceUsage("auto", "state", node, context, {
        appendToDeclaration(declaration) {
            if (node.isParallel) declaration.push([line, keyword("parallel")]);
        },
        forceBrackets: node.isParallel,
    });
}

export function actionBodyJoiner(): ChildrenJoiner {
    const state = {
        stack: [] as {
            type: string;
            isDone: boolean;
        }[],
        continuation: undefined as Doc | undefined,
    };

    const applyIndent = (doc: Doc): Doc => {
        return state.stack.reduce((doc) => indent(doc), doc);
    };

    const advance = (
        child: ElementMeta,
        index: number,
        doc?: Doc,
        previous?: ElementMeta
    ): Doc | undefined => {
        let target = child;
        if (target.is(OwningMembership)) target = target.element();

        if (state.continuation) {
            const continuation = state.continuation;
            state.continuation = undefined;
            if (doc) doc = [continuation, group(indent(line)), doc];
            index--;
        } else {
            switch (target.nodeType()) {
                case TransitionUsage: {
                    if ((target as TransitionUsageMeta).source) {
                        state.stack.length = 0;
                        break;
                    }

                    if (
                        (target as TransitionUsageMeta).else &&
                        state.stack.at(-1)?.type === DecisionNode
                    ) {
                        state.stack[state.stack.length - 1].isDone = true;
                        break;
                    }

                    if (state.stack.at(-1)?.isDone) state.stack.pop();
                    break;
                }

                case SuccessionAsUsage: {
                    const kind = successionAsUsageKind(target as SuccessionAsUsageMeta, previous);
                    if (kind === "regular")
                        // starts with `first` -> not a shorthard so
                        // remove any indentation
                        state.stack.length = 0;
                    else if (state.stack.at(-1)?.isDone) state.stack.pop();
                    if (kind === "empty") {
                        state.continuation = doc;
                        return;
                    }
                    break;
                }

                default: {
                    state.stack.length = 0;
                    break;
                }
            }
        }

        if (doc) {
            if (index !== 0) doc = applyIndent([hardline, doc]);
        }

        if (target.is(ControlNode)) {
            const type = target.nodeType();
            // only decision and fork nodes can have multiple outgoing
            // successions
            if (type === DecisionNode || type === ForkNode)
                state.stack.push({
                    type,
                    isDone: false,
                });
        }

        return doc;
    };

    return function (children, docs, leading?) {
        leading?.forEach((e, i) => advance(e, 0, undefined, i > 0 ? leading[i - 1] : undefined));
        return children
            .map((child, i) =>
                advance(child, i, docs[i], i === 0 ? leading?.at(-1) : children[i - 1])
            )
            .filter(NonNullable);
    };
}
