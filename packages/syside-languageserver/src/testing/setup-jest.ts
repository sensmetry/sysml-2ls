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

/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "@jest/globals";
import type { MatcherContext } from "expect";
import { IRecognitionException, ILexingError } from "chevrotain";
import { Namespace } from "../generated/ast";
import { parseKerML, ParseResult, parseSysML, TEST_BUILD_OPTIONS } from "./utils";
import { isLinkingError, stream } from "langium";
import { getObjectSubset } from "@jest/expect-utils";
import { MatcherHintOptions, printWithType } from "jest-matcher-utils";
import chalk from "chalk";
import { Diagnostic } from "vscode-languageserver";
import { SysMLBuildOptions } from "../services/shared/workspace/document-builder";
import { isJSONConvertible, JSONType, stringify } from "../utils/common";
import { Context } from "jest-snapshot";

// Omit colon and one or more spaces, so can call getLabelPrinter.
const EXPECTED_LABEL = "Expected";
const RECEIVED_LABEL = "Received";

export const EXPECTED_COLOR = chalk.green;
export const RECEIVED_COLOR = chalk.red;

const SPACE_SYMBOL = "\u{00B7}"; // middle dot

// The optional property of matcher context is true if undefined.
const isExpand = (expand?: boolean): boolean => expand !== false;

// Instead of inverse highlight which now implies a change,
// replace common spaces with middle dot at the end of any line.
const replaceTrailingSpaces = (text: string): string =>
    text.replace(/\s+$/gm, (spaces) => SPACE_SYMBOL.repeat(spaces.length));

export const printReceived = (object: unknown): string =>
    RECEIVED_COLOR(replaceTrailingSpaces(stringify(object)));
export const printExpected = (value: unknown): string =>
    EXPECTED_COLOR(replaceTrailingSpaces(stringify(value)));

interface ErrorParameters {
    parserErrors?: IRecognitionException[] | object[];
    lexerErrors?: ILexingError[] | object[];
    diagnostics?: Diagnostic[] | object[];
}

interface MatchOptions extends ErrorParameters {
    buildOptions?: SysMLBuildOptions;
}

interface SanitizedObject {
    [key: string]: any;
}

export const NO_ERRORS: ErrorParameters = {
    parserErrors: [],
    lexerErrors: [],
    diagnostics: [],
};

export function sanitizeTree(
    node?: object | [] | null,
    cache?: Map<object, object>,
    includeMeta?: "include $meta"
): SanitizedObject | JSONType {
    if (node === undefined) return undefined;
    if (node === null) return null;
    if ((node as Record<symbol, string>)[Symbol.toStringTag] === "WeakRef") {
        return sanitizeTree((node as any).ast(), cache, includeMeta);
    }
    if (isLinkingError(node)) {
        return {
            message: node.message,
            property: node.property,
        };
    }
    if (node instanceof Set) {
        return Array.from(stream(node).map((v) => sanitizeTree(v, cache, includeMeta)));
    }

    if (isJSONConvertible(node)) {
        const json = node.toJSON();
        if (typeof json === "object") return sanitizeTree(json, cache, includeMeta);
        return json;
    }

    if (cache === undefined) cache = new Map<object, SanitizedObject>();
    else {
        const cached = cache.get(node);
        if (cached !== undefined) return cached;
    }

    if (Array.isArray(node)) {
        return node.map((v) => sanitizeTree(v, cache, includeMeta));
    }

    if (typeof node !== "object") return node;

    const cached = cache.get(node);
    if (cached) return cached;

    const o: SanitizedObject = {};
    cache.set(node, o);

    if ((node as any).$type !== undefined) o.$type = (node as any).$type;
    if ("nodeType" in node && node.nodeType instanceof Function) o.$type = String(node.nodeType());

    if ((node as any).$meta !== undefined && includeMeta) {
        const meta = (node as any).$meta;
        // TODO: add more relevant properties used by tests
        const cleanMeta: Record<string, any> = {
            language: meta.language, // textual representations
            qualifiedName: meta.qualifiedName, // named elements
            visibility: meta.visibility, // visible elements
            to: sanitizeTree(meta.to, cache, includeMeta), // references
            $type: meta.nodeType(),
        };
        Object.keys(cleanMeta).forEach(
            (key) => cleanMeta[key] === undefined && delete cleanMeta[key]
        );
        (o as any).$meta = cleanMeta;
    }

    for (const key in node) {
        const value = (node as Record<string, any>)[key];
        if (key === "_element") {
            // for relationships
            o["element"] = sanitizeTree(value, cache, includeMeta);
            continue;
        }
        // skip over any Langium specific entries
        if (key.startsWith("$") || key.startsWith("_")) continue;

        if (Array.isArray(value)) {
            o[key] = value.map((element) => {
                if (typeof element === "object") return sanitizeTree(element, cache, includeMeta);
                return element;
            });
            continue;
        }

        if (typeof value === "object") {
            let cached: SanitizedObject | JSONType = cache.get(value);
            if (cached === undefined) cached = sanitizeTree(value, cache, includeMeta);
            o[key] = cached;
            continue;
        }

        o[key] = value;
    }

    return o;
}

async function parses(
    this: Context,
    suffix: string,
    fn: (text: string, options?: SysMLBuildOptions) => Promise<ParseResult>,
    context: MatcherContext,
    received: any,
    value: DeepPartial<Namespace> | undefined,
    { parserErrors, lexerErrors, diagnostics, buildOptions }: MatchOptions
): Promise<CustomMatchResult> {
    // the body is modified from https://github.com/facebook/jest/blob/a20bd2c31e126fc998c2407cfc6c1ecf39ead709/packages/expect/src/matchers.ts#L872-L923
    // there doesn't seem to be a way to reuse the matchers, also jest may hang if a test fails due to infinite recursion in
    // printComplexValues -> printObjectProperties -> printer -> ...
    const matcherName = "toParse" + suffix;
    const options: MatcherHintOptions = {
        isNot: context.isNot,
        promise: context.promise,
    };

    if (typeof value === "object" && value === null) {
        throw new Error(
            context.utils.matcherErrorMessage(
                context.utils.matcherHint(matcherName, undefined, undefined, options),
                `${context.utils.EXPECTED_COLOR(
                    "expected"
                )} value must be a non-null object or 'snapshot'`,
                printWithType("Expected", value, printExpected)
            )
        );
    }

    const makeError = (): Error => {
        return new Error(
            context.utils.matcherErrorMessage(
                context.utils.matcherHint(matcherName, undefined, undefined, options),
                `${context.utils.RECEIVED_COLOR("received")} value must be a string`,
                printWithType("Received", received, printReceived)
            )
        );
    };

    let parseResult: ParseResult;
    if (typeof received === "object" && received) {
        if (
            !Array.isArray(received.diagnostics) ||
            !Array.isArray(received.parserErrors) ||
            !Array.isArray(received.lexerErrors) ||
            !received.value ||
            typeof received.value !== "object"
        ) {
            throw makeError();
        }
        parseResult = received as ParseResult;
    } else if (typeof received !== "string" || received === null) {
        throw makeError();
    } else {
        parseResult = await fn(received, buildOptions);
    }

    const result = {
        parserErrors: parseResult.parserErrors,
        lexerErrors: parseResult.lexerErrors,
        diagnostics: parseResult.diagnostics,
        value: value ? sanitizeTree(parseResult.value, undefined, "include $meta") : undefined,
    };
    const expected = {
        parserErrors: parserErrors,
        lexerErrors: lexerErrors,
        diagnostics: diagnostics,
        value,
    };

    const pass = context.equals(result, expected, [
        context.utils.iterableEquality,
        context.utils.subsetEquality,
    ]);

    const message = pass
        ? (): string =>
              // eslint-disable-next-line prefer-template
              context.utils.matcherHint(matcherName, undefined, undefined, options) +
              "\n\n" +
              `Expected: not ${printExpected(expected)}` +
              (stringify(expected) !== stringify(result)
                  ? `\nReceived:     ${printReceived(result)}`
                  : "")
        : (): string =>
              // eslint-disable-next-line prefer-template
              context.utils.matcherHint(matcherName, undefined, undefined, options) +
              "\n\n" +
              context.utils.printDiffOrStringify(
                  expected,
                  getObjectSubset(result, expected),
                  EXPECTED_LABEL,
                  RECEIVED_LABEL,
                  isExpand(context.expand)
              );

    return { message, pass };
}

// TODO: remove object and require Namespace instead?
expect.extend({
    async toParseKerML(
        received: any,
        value: DeepPartial<Namespace> | object,
        {
            parserErrors = [],
            lexerErrors = [],
            diagnostics = [],
            buildOptions = TEST_BUILD_OPTIONS,
        }: MatchOptions = {}
    ): Promise<CustomMatchResult> {
        // @ts-expect-error missing `snapshotState`
        // https://jestjs.io/docs/expect#custom-snapshot-matchers
        return parses.call(this, "KerML", parseKerML, this, received, value, {
            parserErrors,
            lexerErrors,
            diagnostics,
            buildOptions,
        });
    },

    async toParseSysML(
        received: any,
        value: DeepPartial<Namespace> | object,
        {
            parserErrors = [],
            lexerErrors = [],
            diagnostics = [],
            buildOptions = TEST_BUILD_OPTIONS,
        }: MatchOptions = {}
    ): Promise<CustomMatchResult> {
        // @ts-expect-error missing `snapshotState`
        return parses.call(this, "SysML", parseSysML, this, received, value, {
            parserErrors,
            lexerErrors,
            diagnostics,
            buildOptions,
        });
    },
});

interface CustomMatchResult {
    pass: boolean;
    message(): string;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type DeepPartial<T> = T[keyof T] extends Function
    ? T
    : {
          -readonly [P in keyof T]?: DeepPartial<T[P]>;
      };
interface CustomMatchers<R = unknown> {
    toParseKerML(ast?: DeepPartial<Namespace> | object, options?: MatchOptions): R;
    toParseSysML(ast?: DeepPartial<Namespace> | object, options?: MatchOptions): R;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace jest {
        interface Expect extends CustomMatchers {}
        interface Matchers<R> extends CustomMatchers<R> {}
        interface InverseAsymmetricMatchers extends CustomMatchers {}
    }
}

/**
 * Docs are wrong and {@link expect.objectContaining} is not recursive, use this instead
 */
export function recursiveObjectContaining<T extends object = object>(
    value: T
): ReturnType<(typeof expect)["objectContaining"]> {
    if (typeof value !== "object") return value;
    if (!value) return value;

    const out: Record<string, unknown> = {};
    Object.entries(value).forEach(([k, v]) => {
        out[k] = recursiveObjectContaining(v);
    });

    return expect.objectContaining(out);
}
