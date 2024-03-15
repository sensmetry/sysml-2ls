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
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import * as ast from "../../generated/ast";
import {
    AnyOperator,
    ElementMeta,
    ExpressionMeta,
    FeatureMembershipMeta,
    FeatureMeta,
    FeatureReferenceExpressionMeta,
    IMPLICIT_OPERATORS,
    InvocationExpressionMeta,
    LiteralNumberMeta,
    MetadataAccessExpressionMeta,
    NamespaceRelationship,
    NullExpressionMeta,
    OPERATORS,
    OperatorExpressionMeta,
} from "../KerML";
import { SemanticTokenTypes } from "vscode-languageserver";
import {
    DefaultElementPrinter,
    ElementPrinter,
    ModelPrinterContext,
    assertSysML,
    printModelElement,
} from "./print";
import {
    Doc,
    brackets,
    fill,
    group,
    hardline,
    ifBreak,
    indent,
    indentIfBreak,
    join,
    keyword,
    line,
    literals,
    printInnerComments,
    softline,
    text,
} from "../../utils";
import {
    DescendantPrinter,
    formatPreserved,
    printDescendant,
    printReference,
    throwError,
} from "./utils";
import { printAssignmentExpression, printChaining, printTarget } from "./edges";
import { BasicMetamodel } from "../metamodel";
import { findNodeForKeyword } from "langium";
import { printChildrenBlock, printKerMLFeature } from "./namespaces";
import { TriggerInvocationExpressionMeta } from "../SysML";

/**
 * Expression precedence levels, higher number binds tighter
 */
export const PREC_LEVELS = {
    NONE: 0,
    IF: 1,
    NULL_COALESCING: 2,
    IMPLIES: 3,
    OR: 4,
    XOR: 5,
    AND: 6,
    EQUALITY: 7,
    CLASSIFICATION: 8,
    COMPARISON: 9,
    RANGE: 10,
    ADDITION: 11,
    MULTIPLICITY: 12,
    EXPONENTATION: 13,
    UNARY: 14,
    ALL: 15,
    ACCESS: 16,
    LITERAL: 10000,
} as const;

/**
 * Returns numerical precendence of an operator.
 */
export function precedence(node: ElementMeta): number {
    switch (getOperator(node)) {
        case "":
            return PREC_LEVELS.LITERAL;
        case "'if'":
            return PREC_LEVELS.IF;
        case "'??'":
            return PREC_LEVELS.NULL_COALESCING;
        case "'implies'":
            return PREC_LEVELS.IMPLIES;
        case "'or'":
        case "'|'":
            return PREC_LEVELS.OR;
        case "'xor'":
            return PREC_LEVELS.XOR;
        case "'and'":
        case "'&'":
            return PREC_LEVELS.AND;
        case "'=='":
        case "'==='":
        case "'!='":
        case "'!=='":
            return PREC_LEVELS.EQUALITY;
        case "'istype'":
        case "'hastype'":
        case "'@'":
        case "'@@'":
        case "'as'":
        case "'meta'":
            return PREC_LEVELS.CLASSIFICATION;
        case "'<'":
        case "'<='":
        case "'>'":
        case "'>='":
            return PREC_LEVELS.COMPARISON;
        case "'..'":
            return PREC_LEVELS.RANGE;
        case "'+'":
        case "'-'":
            return getArguments(node)?.length === 1 ? PREC_LEVELS.UNARY : PREC_LEVELS.ADDITION;
        case "'*'":
        case "'/'":
        case "'%'":
            return PREC_LEVELS.MULTIPLICITY;
        case "'**'":
        case "'^'":
            return PREC_LEVELS.EXPONENTATION;
        case "'~'":
        case "'not'":
            return PREC_LEVELS.UNARY;
        case "'all'":
            return PREC_LEVELS.ALL;
        case "'#'":
        case "'['":
        case "'.?'":
        case "'.'":
        case "collect":
        case "'.metadata'":
            return PREC_LEVELS.ACCESS;
        case "','":
            return PREC_LEVELS.NONE;
    }
}

export function getArguments(node: OperatorExpressionMeta): readonly FeatureMeta[];
export function getArguments(node: ElementMeta | undefined): readonly FeatureMeta[] | undefined;
export function getArguments(node: ElementMeta | undefined): readonly FeatureMeta[] | undefined {
    if (!node?.is(ast.OperatorExpression)) return;
    return node.arguments();
}

const HighlightOperator = { type: SemanticTokenTypes.operator };

/**
 * Returns expression operator of `expr`, including implicit operators.
 */
export function getOperator(expr: ElementMeta | undefined): AnyOperator {
    switch (expr?.nodeType()) {
        case ast.SelectExpression:
            return IMPLICIT_OPERATORS.SELECT;
        case ast.FeatureChainExpression:
            return IMPLICIT_OPERATORS.DOT;
        case ast.CollectExpression:
            return IMPLICIT_OPERATORS.COLLECT;
        case ast.OperatorExpression: {
            return (expr as OperatorExpressionMeta).operator;
        }
        case ast.FeatureReferenceExpression:
            return getOperator((expr as FeatureReferenceExpressionMeta).expression?.element());
        case ast.MetadataAccessExpression: {
            const owner = expr.owner();
            if (
                owner?.is(ast.OperatorExpression) &&
                (owner.operator === OPERATORS.AT_AT || owner.operator === OPERATORS.META)
            ) {
                // classification `@@` and `meta` expressions parse metadata
                // access expression without `.metadata`
                return OPERATORS.NONE;
            }
            return IMPLICIT_OPERATORS.METADATA;
        }
        default:
            return OPERATORS.NONE;
    }
}

/**
 * @param expr owning expression
 * @param lhs left-hand argument of `expr`
 * @returns true if `lhs` of `expr` should be printed at the same level
 */
export function shouldFlatten(expr: ElementMeta, lhs: ElementMeta): boolean {
    const leftPrec = precedence(expr);
    const rightPrec = precedence(lhs);
    if (leftPrec !== rightPrec) return false;

    // exponentiation is right associative
    if (leftPrec === PREC_LEVELS.EXPONENTATION) return false;

    // a == b == c -> (a == b) == c
    if (leftPrec === PREC_LEVELS.EQUALITY) return false;

    const leftOp = getOperator(expr);
    const lhsOp = getOperator(lhs);
    if ((leftOp === OPERATORS.MODULO || leftOp !== lhsOp) && leftPrec === PREC_LEVELS.MULTIPLICITY)
        return false;

    return true;
}

function printBinaryOpRhs(
    expr: OperatorExpressionMeta,
    operator: AnyOperator,
    right: Doc,
    context: ModelPrinterContext,
    options: { parens: boolean; flatten: boolean; hasLhs: boolean }
): Doc[] {
    let ws: [Doc, Doc];
    let shouldIndent = false;

    switch (operator) {
        case "":
            /* istanbul ignore next */
            return [paren(right, options.parens)];
        case "'??'":
        case "'implies'":
        case "'or'":
        case "'|'":
        case "'xor'":
        case "'and'":
        case "'&'":
        case "'=='":
        case "'==='":
        case "'!='":
        case "'!=='":
        case "'<'":
        case "'<='":
        case "'>'":
        case "'>='":
        case "'+'":
        case "'-'":
        case "'*'":
        case "'/'":
        case "'%'": {
            ws = [literals.space, line]; // default for "after"
            break;
        }
        case "'istype'":
        case "'hastype'":
        case "'@'":
        case "'@@'":
        case "'as'":
        case "'meta'": {
            // LHS may be a self reference expression which prints as an empty
            // string, we don't need extra space in that case
            ws = [options.hasLhs ? literals.space : literals.emptytext, line]; // default for "after"
            break;
        }
        case "'..'":
        case "'**'":
        case "'^'": {
            ws = [literals.emptytext, softline]; // default for "after"
            shouldIndent = context.format.operator_break === "before";
            break;
        }
        case "'#'":
            return [
                literals.emptytext,
                group([
                    text("#", HighlightOperator),
                    text("("),
                    indent([softline, right]),
                    softline,
                    text(")"),
                ]),
            ];
        case "'['":
            return [
                literals.space,
                group([
                    brackets.square.open,
                    indent([softline, right]),
                    softline,
                    brackets.square.close,
                ]),
            ];
        case "','": {
            // sequence expressions are nested in the rhs argument so check if
            // the rhs is an array and spread it out into the current level
            // sequence expression to make `fill` work with it
            const parts = [literals.emptytext, literals.comma, line];
            if (Array.isArray(right)) return [...parts, ...right];
            return [...parts, right];
        }
        case "'.'":
            return [indent([softline, text(".", HighlightOperator), right])];
        case "collect":
            return [text(".", HighlightOperator), right];
        case "'.?'":
            return [text(".?", HighlightOperator), right];
        case "'if'":
        case "'~'":
        case "'not'":
        case "'all'":
        case "'.metadata'":
            /* istanbul ignore next */
            throw new Error(`${operator} is not a binary operator!`);
    }

    const op: Doc = text(operator.slice(1, -1), HighlightOperator);
    if (context.format.operator_break === "before") {
        ws = [ws[1], ws[0]];
    }
    const contents = [ws[0], op, ws[1], paren(right, options.parens)];
    return shouldIndent ? [literals.emptytext, indent(contents)] : contents;
}

/**
 * Wraps `doc` in round brackets if `condition` is `true`. Use this for wrapping
 * subexpressions as they are also indented if wrapped.
 */
function paren(doc: Doc, condition: boolean): Doc {
    return condition ? [brackets.round.open, indent(doc), brackets.round.close] : doc;
}

const defaultFeaturePrinter: ElementPrinter<FeatureMeta> = (node, context) => {
    if (node.nodeType() === ast.Feature) {
        if (node.chainings.length === 0) {
            // self reference expression
            return literals.emptytext;
        }
        return printChaining(node, context);
    }
    return DefaultElementPrinter(node, context);
};

function shouldParenthesize(expr: ElementMeta, branch: ElementMeta): boolean {
    const exprPrec = precedence(expr);
    const branchPrec = precedence(branch);

    // less_equal since we use left-associative parsing which would put
    // nodes with the same precedence on the lhs by default
    if (branchPrec <= exprPrec) {
        return true;
    }
    if (branchPrec == PREC_LEVELS.AND) {
        // avoid human ambiguities and parenthesize and branches
        return exprPrec == PREC_LEVELS.OR || exprPrec == PREC_LEVELS.XOR;
    }

    if (branchPrec == PREC_LEVELS.UNARY || branchPrec == PREC_LEVELS.ALL) {
        // looks weird without parentheses
        return (
            exprPrec == PREC_LEVELS.RANGE ||
            exprPrec == PREC_LEVELS.ADDITION ||
            exprPrec == PREC_LEVELS.EXPONENTATION ||
            exprPrec == PREC_LEVELS.MULTIPLICITY
        );
    }

    if (exprPrec == PREC_LEVELS.RANGE) {
        return (
            branchPrec == PREC_LEVELS.ADDITION ||
            branchPrec == PREC_LEVELS.EXPONENTATION ||
            branchPrec == PREC_LEVELS.MULTIPLICITY
        );
    }

    return false;
}

function printBinaryishExpressions(
    expr: OperatorExpressionMeta,
    context: ModelPrinterContext,
    printer: ElementPrinter<FeatureMeta> = DefaultElementPrinter
): Doc[] {
    // eslint-disable-next-line prefer-const
    let [lhs, rhs] = expr.arguments();

    // feature chain expressions may not have been linked so memberships
    // would fail, find one explicitly
    rhs ??= expr.children
        .filter(BasicMetamodel.is(ast.Membership))
        // catch also ReturnParameterMemberships that are not arguments
        .find((m) => !m.is(ast.ParameterMembership) || !m.element().value)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.element() as any;

    let right: Doc;
    if (rhs?.owner() === expr) right = printModelElement(rhs, context, { printer });
    else {
        const member = expr.children.find((m) => m.element() === rhs);
        /* istanbul ignore next */
        if (!member)
            throwError(
                expr,
                "Invalid operator expression - missing membership to referenced RHS element"
            );
        right = printTarget(member, context);
    }

    // if precedences are equal, put nested expression in the same group as the
    // owning expression so that all expressions either break or not
    const flatten = shouldFlatten(expr, lhs);
    let hasLhs = true;
    let parts: Doc[];
    if (flatten) {
        // avoid wrapping flattened subexpressions in group
        parts = printModelElement(lhs as OperatorExpressionMeta, context, {
            printer: (node, context) => printBinaryishExpressions(node, context, printer),
        });
    } else {
        const left = printModelElement(lhs, context);
        hasLhs = left !== literals.emptytext;
        // Not in flattening mode, so wrap lhs in parentheses even if
        // precedences are equal as `shouldFlatten` returns false where the lhs
        // node should be wrapped. Sequence expressions don't have to be
        // parenthesized a second time.
        const lhsOp = getOperator(lhs);
        parts = [paren(left, lhsOp !== OPERATORS.COMMA && shouldParenthesize(expr, lhs))];
    }

    const operator = getOperator(expr);
    parts.push(
        ...printBinaryOpRhs(expr, operator, right, context, {
            // less_equal since we use left-associative parsing which would put
            // nodes with the same precedence on the lhs by default
            parens: shouldParenthesize(expr, rhs),
            flatten,
            hasLhs,
        })
    );

    if (
        context.format.sequence_expression_trailing_comma &&
        operator === OPERATORS.COMMA &&
        getOperator(rhs) !== OPERATORS.COMMA
    ) {
        parts.push(
            literals.emptytext,
            ifBreak(literals.comma, literals.emptytext, "sequence-expr")
        );
    }

    return parts;
}

function printConditionalExpression(
    expr: OperatorExpressionMeta | FeatureReferenceExpressionMeta,
    context: ModelPrinterContext,
    nested = false
): Doc {
    if (expr.is(ast.FeatureReferenceExpression)) {
        const target = expr.expression?.element();
        if (!target || !target.is(ast.OperatorExpression) || target.operator != OPERATORS.IF)
            throwError(
                expr,
                "FeatureReferenceExpression does not refer to a conditional expression!"
            );
        expr = target;
    }
    const [test, then, else_] = expr.arguments();

    let hasChain = false;
    let printedElse: Doc;
    /* istanbul ignore if */ // not in grammar
    if (getOperator(else_) === OPERATORS.IF) {
        hasChain = true;
        printedElse = printConditionalExpression(else_ as OperatorExpressionMeta, context, true);
    } else if (
        else_.is(ast.FeatureReferenceExpression) &&
        getOperator(else_.expression?.element()) === OPERATORS.IF
    ) {
        hasChain = true;
        printedElse = printDescendant(else_, context, "else branch")
            .descend((node) => node.expression)
            .descend((node) => node.element())
            .print({
                printer(node, context) {
                    return printConditionalExpression(
                        node as OperatorExpressionMeta,
                        context,
                        true
                    );
                },
            });
    } else {
        printedElse = printModelElement(else_, context);
    }

    const branches = [
        line,
        // align nested branches
        ifBreak(text("?    "), text("? ")),
        indent(printModelElement(then, context)),
        line,
        text("else "),
        hasChain ? printedElse : indent(printedElse),
    ];

    const printedTest = printModelElement(test, context);
    const condition = group([
        text("if", HighlightOperator),
        literals.space,
        getOperator(test) === OPERATORS.IF
            ? group([
                  brackets.round.open,
                  indent([softline, printedTest]),
                  softline,
                  brackets.round.close,
              ])
            : indent(printedTest),
    ]);

    if (nested) {
        return [condition, ...branches];
    }

    return group([condition, indent(branches)]);
}

function printArrowExpression(expr: InvocationExpressionMeta, context: ModelPrinterContext): Doc {
    const args = expr.arguments();
    const nonArg = expr.children
        .find((m): m is FeatureMembershipMeta => m.nodeType() == ast.FeatureMembership)
        ?.element();
    const isExpr =
        args.length === 1 &&
        nonArg &&
        nonArg.nodeType() === ast.Expression &&
        nonArg.specializations().every((s) => s.isImplied);
    const isList = Boolean(!nonArg || args.length >= 2);

    const target = paren(
        printModelElement(args[0], context),
        precedence(args[0]) < PREC_LEVELS.ACCESS && getOperator(args[0]) !== OPERATORS.COMMA
    );
    const func = indent([
        text("->", HighlightOperator),
        printTarget(expr.specializations(ast.FeatureTyping)[0], context),
    ]);

    if (isList) {
        const inner = join(
            [literals.comma, line],
            args.slice(1).map((arg) =>
                printArgument(
                    // args are owned so owner is not null
                    arg.owner() as FeatureMeta,
                    context
                )
            )
        );
        return group(
            [
                target,
                func,
                brackets.round.open,
                indent([softline, inner]),
                softline,
                brackets.round.close,
            ],
            { id: "arg-list" }
        );
    }

    if (isExpr) {
        const inner = printModelElement(nonArg, context);
        return group([target, func, literals.space, inner]);
    }

    if (!nonArg) throwError(expr, "InvocationExpression is missing a FunctionReferenceMember!");
    return fill([
        target,
        softline,
        func,
        indent(line),
        indent(printTarget(nonArg.specializations(ast.FeatureTyping)[0], context)),
    ]);
}

function printUnaryExpression(expr: OperatorExpressionMeta, context: ModelPrinterContext): Doc {
    const operator = expr.operator;
    const arg = expr.arguments().at(0) ?? expr.children[0].element();
    if (!arg)
        throwError(expr, `Unary expression ${expr} is missing an argument or a result member!`);
    return [
        text(operator.slice(1, -1), HighlightOperator),
        operator === OPERATORS.NOT || operator === OPERATORS.ALL
            ? literals.space
            : literals.emptytext,
        paren(
            printModelElement(arg, context),
            precedence(arg) < PREC_LEVELS.UNARY && getOperator(arg) !== OPERATORS.COMMA
        ),
    ];
}

/**
 * Default printer for operator expressions.
 */
export function printOperatorExpression(
    expr: OperatorExpressionMeta,
    context: ModelPrinterContext
): Doc {
    const operator = getOperator(expr);

    switch (operator) {
        case OPERATORS.IF:
            return printConditionalExpression(expr, context);

        case OPERATORS.BITWISE_NOT:
        case OPERATORS.NOT:
        case OPERATORS.ALL:
            return printUnaryExpression(expr, context);

        case IMPLICIT_OPERATORS.DOT: {
            const contents = printBinaryishExpressions(expr, context, defaultFeaturePrinter);
            const owner = expr.owner();
            if (!owner || getOperator(owner) !== IMPLICIT_OPERATORS.DOT) return fill(contents);
            // should be printed directly through printBinaryishExpressions
            /* istanbul ignore next */
            return group(contents);
        }

        case OPERATORS.COMMA: {
            const contents = printBinaryishExpressions(expr, context);
            const owner = expr.owner();
            const ownerOp = owner ? getOperator(owner) : OPERATORS.NONE;
            if (!owner || ownerOp !== OPERATORS.COMMA) {
                // need to wrap a sequence expression with parentheses if this
                // expression is not a nested sequence expression
                return group(
                    [
                        brackets.round.open,
                        indent([softline, fill(contents)]),
                        softline,
                        brackets.round.close,
                    ],
                    { id: "sequence-expr" }
                );
            }

            // avoid grouping nested sequence expressions since they are parsed as
            // the rhs argument
            return contents;
        }

        case "'+'":
        case "'-'": {
            if (expr.arguments().length === 1) return printUnaryExpression(expr, context);
            // fallthrough
        }

        default: {
            return group(printBinaryishExpressions(expr, context));
        }
    }
}

export function printArgument(arg: FeatureMeta, context: ModelPrinterContext): Doc {
    const value = arg.value?.element();

    /* istanbul ignore next */
    if (!value) throwError(arg, "Invalid argument - missing value");

    let rhs = printArgumentValue(value, context);

    const name = arg.specializations().find((s) => !s.isImplied && s.is(ast.Redefinition));
    if (!name) return rhs;

    // named argument

    const space = ifBreak(literals.space, literals.emptytext, "arg-list");
    if (getOperator(value) !== OPERATORS.COMMA) {
        rhs = indentIfBreak([ifBreak(line, literals.emptytext, "arg-list"), rhs], {
            groupId: "assignment",
        });
    } else {
        rhs = [space, rhs];
    }

    return group([printTarget(name, context), space, text("="), rhs], {
        id: "assignment",
    });
}

export function printArgumentValue(value: ExpressionMeta, context: ModelPrinterContext): Doc {
    return printModelElement(value, context);
}

/**
 * Default printer for `InvocationExpression`
 */
export function printInvocationExpr(
    node: InvocationExpressionMeta,
    context: ModelPrinterContext
): Doc {
    if (node.operands.length > 0) {
        return printArrowExpression(node, context);
    }

    const typing = node.specializations(ast.FeatureTyping).at(0);

    /* istanbul ignore next */
    if (!typing) throwError(node, "Invalid InvocationExpression - missing feature typing");

    return [
        printTarget(typing, context),
        group(
            [
                brackets.round.open,
                indent([
                    softline,
                    join(
                        [literals.comma, line],
                        [
                            ...node.operands.map((arg) => printArgumentValue(arg, context)),
                            ...node.argumentMembers().map((arg) => printArgument(arg, context)),
                        ]
                    ),
                ]),
                softline,
                brackets.round.close,
            ],
            { id: "arg-list" }
        ),
    ];
}

export function printLiteralNumber(node: LiteralNumberMeta, context: ModelPrinterContext): Doc {
    let str: string;
    const cst = node.cst()?.text;
    const format = context.format.literal_real;
    // check whether the number has changed from the source file, if it
    // didn't then output the source file string so that floating point
    // number formatting doesn't change.
    if (cst && node.ast()?.literal === node.literal) {
        str = cst;
        // sequence expressions can parse `,` as part of this node so remove
        // it
        if (str.endsWith(",")) str = str.slice(0, -1).trimEnd();
    } else if (node.isInteger) {
        str = node.literal.toFixed(0);
    } else {
        switch (format) {
            case "exp": {
                str = node.literal.toExponential();
                break;
            }
            case "none": {
                str = node.literal.toString();
                break;
            }
            case "prec": {
                str = node.literal.toPrecision();
                break;
            }
        }
    }
    return text(str, { type: SemanticTokenTypes.number });
}

export function printNullExpression(node: NullExpressionMeta, context: ModelPrinterContext): Doc {
    let inner = printInnerComments(node.notes, context, (note) =>
        note.kind === "line" ? hardline : undefined
    );
    if (inner !== literals.emptytext) {
        inner = [literals.space, inner];
    }

    return formatPreserved(node, context.format.null_expression, "null", {
        find: (node) => findNodeForKeyword(node, "null"),
        choose: {
            null: (): Doc => group([keyword("null"), inner]),
            brackets: (): Doc => group([brackets.round.open, brackets.round.close, inner]),
            preserve: (found) => (found ? "null" : "brackets"),
        },
    });
}

export function printExpressionBody(node: ExpressionMeta, context: ModelPrinterContext): Doc {
    if (node.specializations().some((s) => !s.isImplied))
        // a function reference
        return printTarget(node.specializations(ast.FeatureTyping)[0], context);

    return group(
        printChildrenBlock(node, node.children, context, {
            result: node.result,
            insertSpaceBeforeBrackets: false,
            forceEmptyBrackets: true,
        })
    );
}

export function printExpression(node: ExpressionMeta, context: ModelPrinterContext): Doc {
    if (
        node.parent()?.is(ast.FeatureMembership) &&
        node.owner()?.isAny(ast.InvocationExpression, ast.FeatureReferenceExpression)
    ) {
        // this is a body expression
        return printExpressionBody(node, context);
    }

    if (node.owner()?.is(ast.TriggerInvocationExpression)) {
        /* istanbul ignore next */
        if (!node.result) throwError(node, "Invalid change expression - missing result member");
        return printModelElement(node.result, context);
    }

    return printKerMLFeature("expr", node, context);
}

export function printMetadataAccessExpression(
    node: MetadataAccessExpressionMeta,
    context: ModelPrinterContext
): Doc {
    const op = getOperator(node);
    const target = printReference(node.reference, {
        scope: node,
        context,
        astNode: node.ast()?.reference,
    });

    if (op === OPERATORS.NONE) return target;
    return group([
        target,
        indent([softline, text(op.slice(1, -1), { type: SemanticTokenTypes.operator })]),
    ]);
}

export function printTriggerInvocationExpression(
    node: TriggerInvocationExpressionMeta,
    context: ModelPrinterContext
): Doc {
    assertSysML(context, node.nodeType());

    const exprPrinter = ((): DescendantPrinter<NamespaceRelationship, FeatureMeta> => {
        const descendant = printDescendant(
            node.children[0],
            context,
            `trigger invocation expression ${node.kind === "when" ? "change" : "owned"} expression`
        ).descend((node) => {
            /* istanbul ignore next */
            if (!node.is(ast.FeatureMembership))
                throwError(
                    node,
                    "Expected a feature membership as first trigger invocation expression member"
                );

            return node.element();
        });

        switch (node.kind) {
            case "at":
            case "after": {
                return descendant;
            }
            case "when": {
                return descendant
                    .descend((node) => {
                        /* istanbul ignore next */
                        if (!node.is(ast.Feature))
                            throwError(node, "Expected an owned feature value");
                        return node.value;
                    })
                    .descend((node) => node.element());
            }
        }
    })();

    return printAssignmentExpression(
        [keyword(node.kind)],
        exprPrinter.descendant,
        context,
        printModelElement(node.children[0], context, { printer: () => exprPrinter.print() })
    );
}

export function printFeatureReferenceExpression(
    node: FeatureReferenceExpressionMeta,
    context: ModelPrinterContext
): Doc {
    /* istanbul ignore next */
    if (!node.expression)
        throwError(node, "Invalid FeatureReferenceExpression - missing expression");
    return printTarget(node.expression, context, {
        printer: defaultFeaturePrinter,
    });
}
