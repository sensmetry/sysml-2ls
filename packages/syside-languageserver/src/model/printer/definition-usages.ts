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
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { findNodeForKeyword } from "langium";
import * as ast from "../../generated/ast";
import { Doc, group, indent, keyword, line, literals } from "../../utils";
import { ResultExpressionMembershipMeta } from "../KerML";
import {
    AssertConstraintUsageMeta,
    AttributeUsageMeta,
    DefinitionMeta,
    EnumerationUsageMeta,
    EventOccurrenceUsageMeta,
    ExhibitStateUsageMeta,
    IncludeUseCaseUsageMeta,
    OccurrenceDefinitionMeta,
    OccurrenceUsageMeta,
    PerformActionUsageMeta,
    PortUsageMeta,
    ReferenceUsageMeta,
    SatisfyRequirementUsageMeta,
    UsageMeta,
} from "../SysML";
import { PreservableFormatting } from "./format-options";
import {
    TypePrinterOptions,
    defaultSpecializationGrouper,
    featureValueAppender,
    printChildrenBlock,
    printGenericFeature,
    printSpecializationPart,
    printType,
} from "./namespaces";
import { ModelPrinterContext, assertSysML, printModelElement } from "./print";
import { formatPreserved, shouldIgnoreRef, throwError } from "./utils";
import { printTarget } from "./edges";
import { actionBodyJoiner } from "./actions";
import { SubtypeKeys } from "../../services";

/**
 * Returns an array of usage modifiers to be used with `prinUsage`.
 */
export function sysmlUsageModifiers(node: UsageMeta, ignoreRef = false): Doc[] {
    const modifiers: Doc[] = [];

    if (node.explicitDirection !== "none") modifiers.push(keyword(node.explicitDirection));

    // variation implies abstract so print it first
    if (node.isVariation) modifiers.push(keyword("variation"));
    else if (node.isAbstract) modifiers.push(keyword("abstract"));

    if (node.isReadonly) modifiers.push(keyword("readonly"));
    if (node.isDerived) modifiers.push(keyword("derived"));
    if (node.isEndExplicitly) modifiers.push(keyword("end"));

    if (!ignoreRef && node.isReferenceExplicitly && node.nodeType() !== ast.ReferenceUsage)
        modifiers.push(keyword("ref"));

    return modifiers;
}

export function definitionModifiers(node: DefinitionMeta | UsageMeta): Doc[] {
    return node.isVariation ? [keyword("variation")] : node.isAbstract ? [keyword("abstract")] : [];
}

export function occurrenceUsageModifiers(node: OccurrenceUsageMeta, ignoreRef = false): Doc[] {
    const modifiers = sysmlUsageModifiers(node, ignoreRef);

    if (node.isIndividual) modifiers.push(keyword("individual"));
    if (node.portionKind) modifiers.push(keyword(node.portionKind));
    return modifiers;
}

export function occurrenceDefinitionModifiers(node: OccurrenceDefinitionMeta): Doc[] {
    const modifiers = definitionModifiers(node);
    if (node.isIndividual) modifiers.push(keyword("individual"));
    return modifiers;
}

export interface UsagePrinterOptions<T extends UsageMeta = UsageMeta>
    extends TypePrinterOptions<T> {
    ignoreRef?: boolean;
}

/**
 * Generic printer for usages.
 */
export function printGenericUsage<T extends UsageMeta>(
    modifiers: Doc[] | "auto",
    kw: string | undefined,
    node: T & { result?: ResultExpressionMembershipMeta },
    context: ModelPrinterContext,
    options: UsagePrinterOptions<T> = { appendToDeclaration: featureValueAppender(node, context) }
): Doc {
    assertSysML(context, node.nodeType());
    return printGenericFeature(
        modifiers === "auto" ? sysmlUsageModifiers(node, options?.ignoreRef) : modifiers,
        kw,
        node,
        context,
        { ...options, join: actionBodyJoiner() }
    );
}

/**
 * Generic printer for occurrence usages.
 */
export function printGenericOccurrenceUsage<T extends OccurrenceUsageMeta>(
    modifiers: Doc[] | "auto",
    kw: string | undefined,
    node: T & { result?: ResultExpressionMembershipMeta },
    context: ModelPrinterContext,
    options: UsagePrinterOptions<T> = { appendToDeclaration: featureValueAppender(node, context) }
): Doc {
    assertSysML(context, node.nodeType());
    return printGenericFeature(
        modifiers === "auto" ? occurrenceUsageModifiers(node, options?.ignoreRef) : modifiers,
        kw,
        node,
        context,
        { ...options, join: actionBodyJoiner() }
    );
}

/**
 * Generic printer for definitions.
 *
 * @param modifiers if `undefined`, default modifiers will be computed
 */
export function printGenericDefinition<T extends DefinitionMeta>(
    modifiers: Doc[] | "auto",
    kw: string,
    node: T & { result?: ResultExpressionMembershipMeta },
    context: ModelPrinterContext,
    options: TypePrinterOptions<T> = {}
): Doc {
    return printType(
        modifiers === "auto" ? definitionModifiers(node) : modifiers,
        kw,
        node,
        context,
        { ...options, join: actionBodyJoiner() }
    );
}

/**
 * Generic printer for occurrence definitions.
 */
export function printGenericOccurrenceDefinition<T extends OccurrenceDefinitionMeta>(
    modifiers: Doc[] | "auto",
    kw: string,
    node: T & { result?: ResultExpressionMembershipMeta },
    context: ModelPrinterContext,
    options: TypePrinterOptions<T> = {}
): Doc {
    return printType(
        modifiers === "auto" ? occurrenceDefinitionModifiers(node) : modifiers,
        kw,
        node,
        context,
        { ...options, join: actionBodyJoiner() }
    );
}

export interface OccurrenceUsageSubtypeOptions
    extends Pick<TypePrinterOptions<OccurrenceUsageMeta>, "join"> {
    format: PreservableFormatting<"always" | "as_needed">;
    suffix: Doc | undefined | "default";
    declarationOnly?: boolean;
    forceBrackets?: boolean;
    ignoreRef?: boolean;
}

export function printOccurrenceUsageSubtype(
    keywords: string[],
    node: OccurrenceUsageMeta,
    context: ModelPrinterContext,
    options: OccurrenceUsageSubtypeOptions
): Doc {
    const hasIdentifier = node.declaredName || node.declaredShortName;

    const { suffix } = options;
    const appendToDeclaration =
        suffix === "default"
            ? featureValueAppender(node, context)
            : (decl: Doc[]): void => {
                  if (suffix) decl.push(suffix);
              };

    const optionalKw = keywords.length > 1 ? keywords[keywords.length - 1] : undefined;
    let hasKw = Boolean(optionalKw);
    const required = hasKw ? keywords.slice(0, -1) : keywords;
    if (
        optionalKw &&
        !hasIdentifier &&
        node
            .specializations()
            .find((s) => !s.isImplied)
            ?.nodeType() === ast.ReferenceSubsetting
    ) {
        const kw = formatPreserved(node, options.format, "always", {
            find: (node) => findNodeForKeyword(node, optionalKw.split(" ").at(-1) as string),
            choose: {
                always: () => optionalKw,
                as_needed: () => undefined,
                preserve: (found) => (found ? "always" : "as_needed"),
            },
        });

        hasKw = Boolean(kw);
    }

    const kw = options.declarationOnly
        ? hasKw
            ? optionalKw
            : undefined
        : (hasKw ? keywords : required).join(" ");

    return printGenericOccurrenceUsage(options.declarationOnly ? [] : "auto", kw, node, context, {
        skipFirstSpecializationKeyword: !hasKw,
        specializations: (node) => {
            if (hasKw) return defaultSpecializationGrouper(context)(node);
            const explicit = node.specializations().filter((s) => !s.isImplied);
            return [[explicit[0]], explicit.slice(1)];
        },
        appendToDeclaration,
        skipChildren: Boolean(options.declarationOnly),
        forceBrackets: options.forceBrackets,
        join: options.join,
        ignoreRef: options.ignoreRef,
    });
}

export function printAssertConstraint(
    node: AssertConstraintUsageMeta,
    context: ModelPrinterContext,
    declarationOnly?: boolean
): Doc {
    return printOccurrenceUsageSubtype(
        [node.isNegated ? "assert not" : "assert", "constraint"],
        node,
        context,
        {
            format: context.format.assert_constraint_usage_keyword,
            suffix: undefined,
            declarationOnly,
        }
    );
}

export function printEventOccurrence(
    node: EventOccurrenceUsageMeta,
    context: ModelPrinterContext,
    declarationOnly?: boolean
): Doc {
    return printOccurrenceUsageSubtype(["event", "occurrence"], node, context, {
        format: context.format.event_occurrence_keyword,
        declarationOnly,
        suffix: "default",
        ignoreRef: shouldIgnoreRef(node, context.format.event_occurrence_reference_keyword),
    });
}

export function printExhibitState(
    node: ExhibitStateUsageMeta,
    context: ModelPrinterContext,
    declarationOnly?: boolean
): Doc {
    let suffix: "default" | Doc[] = "default";
    if (node.isParallel) {
        suffix = [];
        if (node.value) {
            suffix.push(literals.space, printModelElement(node.value, context));
        }
        suffix.push(indent([line, keyword("parallel")]));
    }
    return printOccurrenceUsageSubtype(["exhibit", "state"], node, context, {
        format: context.format.exhibit_state_usage_keyword,
        declarationOnly,
        suffix,
        forceBrackets: node.isParallel,
        join: actionBodyJoiner(),
        ignoreRef: shouldIgnoreRef(node, context.format.exhibit_state_reference_keyword),
    });
}

export function printIncludeUseCase(
    node: IncludeUseCaseUsageMeta,
    context: ModelPrinterContext,
    declarationOnly?: boolean
): Doc {
    return printOccurrenceUsageSubtype(["include", "use case"], node, context, {
        format: context.format.include_use_case_usage_keyword,
        declarationOnly,
        suffix: "default",
        ignoreRef: shouldIgnoreRef(node, context.format.include_use_case_reference_keyword),
    });
}

export function printPerformAction(
    node: PerformActionUsageMeta,
    context: ModelPrinterContext,
    declarationOnly?: boolean
): Doc {
    return printOccurrenceUsageSubtype(["perform", "action"], node, context, {
        format: context.format.perform_action_usage_keyword,
        declarationOnly,
        suffix: "default",
        ignoreRef: shouldIgnoreRef(node, context.format.perform_action_reference_keyword),
    });
}

export function printSatisfyRequirement(
    node: SatisfyRequirementUsageMeta,
    context: ModelPrinterContext,
    declarationOnly?: boolean
): Doc {
    const suffix: Doc[] = [];
    if (node.value) suffix.push(literals.space, printModelElement(node.value, context));
    if (node.satisfactionSubject) {
        const subjectValue = node.satisfactionSubject.element()?.value;
        /* istanbul ignore next */
        if (!subjectValue)
            throwError(
                node.satisfactionSubject,
                "Invalid satisfaction subject - target element doesn't have value"
            );
        suffix.push(line, keyword("by "), indent(printTarget(subjectValue, context)));
    }

    const assert = formatPreserved(
        node,
        context.format.satisfy_requirement_assert_keyword,
        "always",
        {
            find: (node) => findNodeForKeyword(node, "assert"),
            choose: {
                always: () => "assert ",
                never: () => "",
                preserve: (found) => (found ? "always" : "never"),
            },
        }
    );

    return printOccurrenceUsageSubtype(
        [assert + (node.isNegated ? "not satisfy" : "satisfy"), "requirement"],
        node,
        context,
        {
            format: context.format.satisfy_requirement_keyword,
            suffix: indent(group(suffix)),
            declarationOnly,
        }
    );
}

export function printEnumerationUsage(
    node: EnumerationUsageMeta,
    context: ModelPrinterContext
): Doc {
    if (!node.owner()?.is(ast.EnumerationDefinition))
        return printGenericUsage("auto", "enum", node, context, {
            appendToDeclaration: featureValueAppender(node, context),
            ignoreRef: shouldIgnoreRef(node, context.format.attribute_usage_reference_keyword),
        });

    const kw = formatPreserved(node, context.format.enum_member_keyword, "always", {
        find: (node) => findNodeForKeyword(node, "enum"),
        choose: {
            always: () => keyword("enum"),
            never: () => literals.emptytext,
            preserve: (found) => (found ? "always" : "never"),
        },
    });
    return printGenericUsage(
        "auto",
        kw === literals.emptytext ? undefined : kw.contents,
        node,
        context,
        { appendToDeclaration: featureValueAppender(node, context), ignoreRef: true }
    );
}

export function printOccurrenceDefinition(
    node: OccurrenceDefinitionMeta,
    context: ModelPrinterContext
): Doc {
    let kw: string;
    if (node.isIndividual)
        kw = formatPreserved(node, context.format.occurrence_keyword, "always", {
            find: (node) => findNodeForKeyword(node, "occurrence"),
            choose: {
                always: () => "occurrence def",
                as_needed: () => "def",
                preserve: (found) => (found ? "always" : "as_needed"),
            },
        });
    else kw = "occurrence def";
    return printGenericOccurrenceDefinition("auto", kw, node, context);
}

export function printOccurrenceUsage(node: OccurrenceUsageMeta, context: ModelPrinterContext): Doc {
    let kw: string | undefined;
    if (node.isIndividual || node.portionKind)
        kw = formatPreserved(node, context.format.occurrence_keyword, "always", {
            find: (node) => findNodeForKeyword(node, "occurrence"),
            choose: {
                always: () => "occurrence",
                as_needed: () => undefined,
                preserve: (found) => (found ? "always" : "as_needed"),
            },
        });
    else kw = "occurrence";
    return printGenericOccurrenceUsage("auto", kw, node, context);
}

export function printPortUsage(node: PortUsageMeta, context: ModelPrinterContext): Doc {
    if (
        node.isEndExplicitly &&
        node.parent()?.is(ast.FeatureMembership) &&
        node.owner()?.isAny(ast.InterfaceDefinition, ast.InterfaceUsage)
    ) {
        // this should be DefaultInterfaceEnd
        const modifiers: Doc[] = [];
        if (node.explicitDirection !== "none") modifiers.push(keyword(node.direction));
        modifiers.push(...definitionModifiers(node), keyword("end"));
        return printGenericFeature(modifiers, undefined, node, context);
    }
    return printGenericOccurrenceUsage("auto", "port", node, context, {
        appendToDeclaration: featureValueAppender(node, context),
        ignoreRef: node.owningType?.isAny(ast.PortUsage, ast.PortDefinition)
            ? false
            : shouldIgnoreRef(node, context.format.port_usage_reference_keyword),
    });
}

export function printReferenceUsage(node: ReferenceUsageMeta, context: ModelPrinterContext): Doc {
    let refKw: "ref" | undefined | "missing";
    const getKw = (): "ref" | undefined => {
        if (refKw === undefined) {
            refKw = formatPreserved(node, context.format.reference_usage_keyword, "always", {
                find: (node) => findNodeForKeyword(node, "ref"),
                choose: {
                    always: (): "ref" => "ref",
                    as_needed: (): "missing" => "missing",
                    preserve: (found) => (found ? "always" : "as_needed"),
                },
                // seems like there's a bug in typescript inference which adds
                // `preserve` return types to actual return types
            }) as "ref" | "missing";
        }

        return refKw === "missing" ? undefined : refKw;
    };

    if (
        node.parent()?.nodeType() === ast.VariantMembership &&
        canPrintShorthandUsage(node, ast.ReferenceSubsetting) &&
        !getKw()
    ) {
        return printShorthandUsage(node, context);
    }

    return printGenericUsage(
        "auto",
        // DefaultReferenceUsage cannot be used in variant memberships and as
        // interface members
        node.parent()?.nodeType() === ast.VariantMembership ||
            node.owner()?.isAny(ast.InterfaceDefinition, ast.InterfaceUsage)
            ? "ref"
            : getKw(),
        node,
        context
    );
}

export function canPrintShorthandUsage(
    node: UsageMeta,
    firstSpec: SubtypeKeys<ast.Inheritance> = ast.ReferenceSubsetting
): boolean {
    return (
        node.prefixes.length === 0 &&
        sysmlUsageModifiers(node).length === 0 &&
        !node.value &&
        !node.declaredName &&
        !node.declaredShortName &&
        !node.multiplicity &&
        !node.isOrderedExplicitly &&
        !node.isNonUnique &&
        node
            .specializations()
            .find((s) => !s.isImplied)
            ?.nodeType() === firstSpec
    );
}

export function printShorthandUsage(node: UsageMeta, context: ModelPrinterContext): Doc {
    return [
        printSpecializationPart(node, context, {
            skipFirstKeyword: true,
            specializations(node) {
                const explicit = node.specializations().filter((s) => !s.isImplied);
                return [[explicit[0]], explicit.slice(1)];
            },
            ignoreMultiplicity: true,
        }),
        printChildrenBlock(node, node.children, context, {
            insertSpaceBeforeBrackets: true,
        }),
    ];
}

export function printAttributeUsage(node: AttributeUsageMeta, context: ModelPrinterContext): Doc {
    return printGenericUsage("auto", "attribute", node, context, {
        appendToDeclaration: featureValueAppender(node, context),
        ignoreRef: shouldIgnoreRef(node, context.format.attribute_usage_reference_keyword),
    });
}
