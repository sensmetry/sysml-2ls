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

import { findNodeForKeyword } from "langium";
import {
    Membership,
    StateDefinition,
    StateSubactionMembership,
    StateUsage,
} from "../../generated/ast";
import { Doc, group, indent, keyword, line, literals } from "../../utils";
import {
    ElementMeta,
    EndFeatureMembershipMeta,
    ExpressionMeta,
    FeatureMeta,
    MembershipMeta,
    OwningMembershipMeta,
    ResultExpressionMembershipMeta,
} from "../KerML";
import {
    AcceptActionUsageMeta,
    ActionUsageMeta,
    SuccessionAsUsageMeta,
    TransitionFeatureMembershipMeta,
    TransitionUsageMeta,
} from "../SysML";
import {
    actionBodyJoiner,
    printAccepterParameterPart,
    printCondition,
    printSubaction,
} from "./actions";
import { SourceFormatAlways, printConnectorAsUsage, printConnectorEndMember } from "./connectors";
import { printAsTarget, printChaining } from "./edges";
import {
    printChildrenBlock,
    printGenericFeature,
    printDeclaredMultiplicityRange,
} from "./namespaces";
import { ModelPrinterContext, printModelElement } from "./print";
import {
    assertMember,
    formatPreserved,
    hasFeatureDeclaration,
    printDescendant,
    selectDeclarationKeyword,
} from "./utils";

const isExplicitConnectorEnd = (end: EndFeatureMembershipMeta): boolean =>
    Boolean(
        end
            .element()
            ?.specializations()
            .some((s) => !s.isImplied)
    );

export function successionAsUsageKind(
    node: SuccessionAsUsageMeta,
    previousSibling?: ElementMeta
): "target" | "empty" | "regular" | "transition" {
    if (previousSibling?.is(StateSubactionMembership) && previousSibling.kind === "entry") {
        return node.ends.some(isExplicitConnectorEnd) ? "transition" : "empty";
    }

    const ends = node.ends;

    switch (ends.length) {
        /* istanbul ignore next */
        case 1: {
            return isExplicitConnectorEnd(ends[0]) ? "target" : "empty";
        }
        /* istanbul ignore next */
        case 0: {
            return "empty";
        }
        default: {
            // need to disambiguate between regular succession and target succession
            if (ends.every(isExplicitConnectorEnd)) {
                return "regular";
            }

            if (isExplicitConnectorEnd(ends[1])) {
                return "target";
            }

            return "empty";
        }
    }
}

function printMultiplicitySourceEnd(
    node: SuccessionAsUsageMeta,
    context: ModelPrinterContext
): Doc | undefined {
    const range = node.ends[0].element()?.multiplicity?.element()?.range?.element();
    if (!range) return undefined;
    return group(
        printDescendant(node, context, "empty succession")
            .descend((node) => node.ends[0])
            .descend((node) => node.element())
            .descend((node) => node.multiplicity)
            .descend((node) => node.element())
            .descend((node) => node.range)
            .descend((node) => node.element())
            .print({
                printer(range, context) {
                    return printDeclaredMultiplicityRange(range, context);
                },
            })
    );
}

function printEmptySuccessionAsUsage(
    node: SuccessionAsUsageMeta,
    context: ModelPrinterContext
): Doc {
    const src = printMultiplicitySourceEnd(node, context);
    if (!src) return keyword("then");
    return [keyword("then "), src];
}

function printTargetSuccession(node: SuccessionAsUsageMeta, context: ModelPrinterContext): Doc {
    const parts: Doc[] = [];
    const src = printMultiplicitySourceEnd(node, context);
    if (src) {
        parts.push(src);
        parts.push(literals.space);
    }
    parts.push(keyword("then "));
    parts.push(printConnectorEndMember(node.ends[node.ends.length - 1], context));
    parts.push(
        printChildrenBlock(node, node.children, context, {
            insertSpaceBeforeBrackets: true,
            join: actionBodyJoiner(),
        })
    );
    return parts;
}

function printRegularSuccession(node: SuccessionAsUsageMeta, context: ModelPrinterContext): Doc {
    return printConnectorAsUsage(
        selectDeclarationKeyword(node, "succession", context.format.succession_as_usage_keyword),
        node,
        context,
        {
            binding: keyword("then"),
            format: "binary",
            source: {
                keyword: "first",
                format: SourceFormatAlways,
            },
            printer: printConnectorEndMember,
        }
    );
}

function printSuccessionAfterEntry(node: SuccessionAsUsageMeta, context: ModelPrinterContext): Doc {
    // Note that this exists solely because langium cannot parse sequence of
    // child elements meaning that this can actually be empty succession usage
    // instead
    if (!isExplicitConnectorEnd(node.ends[node.ends.length - 1]))
        return printEmptySuccessionAsUsage(node, context);

    return [
        printEmptySuccessionAsUsage(node, context),
        literals.space,
        printConnectorEndMember(node.ends[node.ends.length - 1], context),
        literals.semicolon,
    ];
}

export function printSuccessionAsUsage(
    node: SuccessionAsUsageMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    switch (successionAsUsageKind(node, previousSibling)) {
        case "target":
            return printTargetSuccession(node, context);
        case "empty":
            return printEmptySuccessionAsUsage(node, context);
        case "regular":
            return printRegularSuccession(node, context);
        case "transition":
            return printSuccessionAfterEntry(node, context);
    }
}

function printAccepter(
    node: OwningMembershipMeta<AcceptActionUsageMeta>,
    context: ModelPrinterContext
): Doc {
    return printModelElement(node, context, {
        printer: (node, context) =>
            group([
                keyword("accept "),
                indent(printAccepterParameterPart(node.element(), context)),
            ]),
    });
}

function printGuard(
    node: TransitionFeatureMembershipMeta<ExpressionMeta>,
    context: ModelPrinterContext
): Doc {
    return printModelElement(node, context, {
        printer: (node, context) =>
            group(
                printCondition(
                    keyword("if"),
                    node,
                    context,
                    context.format.transition_usage_parenthesize_guard
                )
            ),
    });
}

function printEffect(
    node: OwningMembershipMeta<ActionUsageMeta & { result?: ResultExpressionMembershipMeta }>,
    context: ModelPrinterContext
): Doc {
    return printModelElement(node, context, {
        printer: (node, context) => {
            const decl = printSubaction(node.element(), context, literals.emptytext);
            if (decl === literals.emptytext) return keyword("do");
            return group([keyword("do "), decl]);
        },
    });
}

function printThenElse(
    kw: string,
    node: OwningMembershipMeta<SuccessionAsUsageMeta>,
    context: ModelPrinterContext
): Doc {
    return printModelElement(node, context, {
        printer: (node, context) =>
            group([
                keyword(kw),
                literals.space,
                printTransitionSuccession(node.element(), context),
            ]),
    });
}

function printSource(node: MembershipMeta<FeatureMeta>, context: ModelPrinterContext): Doc {
    // `printTarget` only prints chainings for inheritance relationships, but
    // here any owning membership will print chaining to match grammar
    if (node.nodeType() === Membership) return printAsTarget(node, context);
    return printModelElement(node, context, {
        printer: (node, context) => printChaining(node.element() as FeatureMeta, context),
    });
}

function printTransitionSuccession(node: SuccessionAsUsageMeta, context: ModelPrinterContext): Doc {
    return printModelElement(node, context, {
        printer: (node, context) => printConnectorEndMember(node.ends[1], context),
    });
}

type TransitionUsageKind =
    | "default-target"
    | "guarded-target"
    | "guarded-succession"
    | "transition"
    | "target-transition";

function transitionUsageKind(
    node: TransitionUsageMeta,
    previousSibling?: ElementMeta
): TransitionUsageKind {
    if (node.else) return "default-target";

    if (node.owner()?.isAny(StateUsage, StateDefinition)) {
        if (node.source) return "transition";
        if (node.accepter || node.effect) return "target-transition";
        if (
            previousSibling?.is(StateSubactionMembership) &&
            previousSibling.kind === "entry" &&
            node.guard
        )
            return "guarded-target";
        return "target-transition";
    }

    // assuming owned by action element
    return node.source ? "guarded-succession" : "guarded-target";
}

function printDefaultTargetSuccession(
    node: TransitionUsageMeta,
    context: ModelPrinterContext
): Doc {
    assertMember(node, node.else, "default target succession", "else");
    return [
        printThenElse("else", node.else, context),
        printChildrenBlock(node, node.children, context, {
            insertSpaceBeforeBrackets: true,
            join: actionBodyJoiner(),
        }),
    ];
}

function printGuardedTargetSuccession(
    node: TransitionUsageMeta,
    context: ModelPrinterContext
): Doc {
    assertMember(node, node.guard, "guarded target succession", "guard");
    assertMember(node, node.then, "guarded target succession", "then");

    const parts: Doc[] = [
        group([
            printGuard(node.guard, context),
            indent([line, printThenElse("then", node.then, context)]),
        ]),
    ];

    if (node.owner()?.isAny(StateDefinition, StateUsage)) {
        // assume entry transition member
        parts.push(literals.semicolon);
    } else {
        parts.push(
            printChildrenBlock(node, node.children, context, {
                insertSpaceBeforeBrackets: true,
                join: actionBodyJoiner(),
            })
        );
    }

    return parts;
}

function printGuardedSuccession(node: TransitionUsageMeta, context: ModelPrinterContext): Doc {
    assertMember(node, node.source, "guarded succession", "source");
    assertMember(node, node.guard, "guarded succession", "guard");
    assertMember(node, node.then, "guarded succession", "then");

    const suffix: Doc[] = [
        group([keyword("first "), indent(printSource(node.source, context))]),
        line,
        group([
            printGuard(node.guard, context),
            indent([line, printThenElse("then", node.then, context)]),
        ]),
    ];

    return printGenericFeature(
        [],
        hasFeatureDeclaration(node) ? "succession" : undefined,
        undefined,
        node,
        context,
        {
            appendToDeclaration(decl) {
                if (decl.length > 0) decl.push(indent(line));
                decl.push(indent(group(suffix)));
            },
            join: actionBodyJoiner(),
        }
    );
}

// TransitionUsage and TargetTransitionUsage rules are nearly identical
function printDefaultTransitionUsage(node: TransitionUsageMeta, context: ModelPrinterContext): Doc {
    assertMember(node, node.then, "transition usage", "then");

    const parts: Doc[] = [];

    const accepter: undefined | Doc = node.accepter
        ? group(printAccepter(node.accepter, context))
        : undefined;
    let guard: undefined | Doc = node.guard ? group(printGuard(node.guard, context)) : undefined;
    let effect: undefined | Doc = node.effect
        ? group(printEffect(node.effect, context))
        : undefined;

    let then: undefined | Doc = group(printThenElse("then", node.then, context));

    if (accepter) parts.push(accepter);
    if (guard) {
        if (effect) {
            guard = group([guard, indent([line, effect])]);
            effect = undefined;
        } else {
            guard = group([guard, indent([line, then])]);
            then = undefined;
        }
        parts.push(guard);
    }
    if (effect) parts.push(effect);
    if (then) parts.push(then);

    const suffix = parts.map((part, i) => indent(i === 0 ? part : [line, part]));
    if (node.source) {
        const first = selectDeclarationKeyword(
            node,
            "first",
            context.format.transition_usage_first_keyword
        );
        let source = printSource(node.source, context);
        if (first) source = group(indent([keyword(first), literals.space, indent(source)]));
        else source = indent(source);

        return printGenericFeature([], "transition", undefined, node, context, {
            appendToDeclaration(decl) {
                decl.push(indent(line), group([source, indent(line), suffix]));
            },
            join: actionBodyJoiner(),
        });
    }

    // `transition` is only required if node has effect without accepter or guard
    const kw =
        node.effect && !node.guard && !node.accepter
            ? "transition"
            : formatPreserved(node, context.format.transition_usage_keyword, "always", {
                  find: (node) => findNodeForKeyword(node, "transition"),
                  choose: {
                      always: () => "transition",
                      as_needed: () => undefined,
                      preserve: (found) => (found ? "always" : "as_needed"),
                  },
              });

    const decl: Doc[] = [];
    if (kw) decl.push(keyword(kw), indent(line));
    decl.push(group(suffix));

    return [
        group(decl),
        printChildrenBlock(node, node.children, context, {
            insertSpaceBeforeBrackets: true,
            join: actionBodyJoiner(),
        }),
    ];
}

export function printTransitionUsage(
    node: TransitionUsageMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    switch (transitionUsageKind(node, previousSibling)) {
        case "default-target":
            return printDefaultTargetSuccession(node, context);
        case "guarded-target":
            return printGuardedTargetSuccession(node, context);
        case "guarded-succession":
            return printGuardedSuccession(node, context);
        case "transition":
        case "target-transition":
            return printDefaultTransitionUsage(node, context);
    }
}
