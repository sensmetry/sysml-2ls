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

import { AstNode, CstNode, DeepPartial, LangiumDocument, OperationCancelled } from "langium";
import { isAbstractRule, isRuleCall } from "langium/lib/grammar/generated/ast";
import { CancellationToken, Range } from "vscode-languageserver";
import { Element, isElementReference } from "../generated/ast";
import { performance } from "perf_hooks";
import { BasicMetamodel, Metamodel, isMetamodel } from "../model";
import path from "path";

/**
 * Sanitize range as returned by Langium parser such that it doesn't result in
 * errors later on
 *
 * TODO: may have been fixed by https://github.com/langium/langium/pull/816
 * @param range Range object
 * @returns Range object that doesn't contain null
 */
export function sanitizeRange(range: Range): Range {
    // Langium somehow puts null values after rebuilding a document so make sure
    // they are numbers here
    const start = { line: range.start.line ?? 0, character: range.start.character ?? 0 };
    const r: Range = { start, end: range.end };
    if (!Range.is(r)) {
        // for whatever unknown reasons, `??` doesn't work on null end values...
        // this seems to work
        return { start, end: start };
    }
    return r;
}

/**
 * JSON replacer function for metamodel objects
 * @param key
 * @param value
 * @returns
 */
export function JSONMetaReplacer(key: string, value: unknown): unknown {
    if (isJSONConvertible(value)) {
        return JSONMetaReplacer(key, value.toJSON());
    }

    // skip internal/implementation members
    if (key.startsWith("$") || key.startsWith("_")) return;

    if (key.length > 0 && isMetamodel(value)) {
        // serialize all internal nodes
        if (value.is(Element)) return value.qualifiedName;
        return `[Node ${value.nodeType()}]`;
    }

    return value;
}

/**
 * Find the rule name used to parse {@link node}
 * @param node CST node
 * @returns Rule name if one was found, otherwise undefined
 */
export function cstNodeRuleName(node?: CstNode): string | undefined {
    if (!node) return;
    let element: AstNode | undefined = node.feature;
    while (element) {
        if (isAbstractRule(element)) return element.name;
        if (isRuleCall(element)) return element.rule.ref?.name;
        element = element.$container;
    }

    return;
}

type DebugCstNode = {
    /**
     * Text used to parse a CST node
     */
    text: string;

    /**
     * Stacktrace of rule names used to parse a CST node
     */
    stack: string[];
};

/**
 * Collect stacktrace of rules used to parse {@link node} and return an object
 * that can be serialized by JSON for debugging purposes
 * @param node CST node
 * @param depth Stacktrace depth
 * @returns
 */
export function simplifyCstNode(node: CstNode, depth = 2): DebugCstNode {
    const tree: string[] = [];
    let cst: CstNode | undefined = node;
    while (cst) {
        const rule = cstNodeRuleName(cst);
        if (rule) {
            tree.push(rule);
            if (tree.length === depth) break;
        }
        cst = cst.parent;
    }

    return {
        text: node.text,
        stack: tree,
    };
}

/**
 * JSON replacer function mainly for AST nodes
 * @param key
 * @param value
 * @returns
 */
export function JSONreplacer(key: string, value: unknown): unknown {
    if (isJSONConvertible(value)) {
        return JSONreplacer(key, value.toJSON());
    }

    if (key === "$meta") {
        if (!isMetamodel(value) || !value.is(Element)) return value;
        // only serialize basic metamodel data to avoid circular references
        return {
            elementId: value.elementId,
            qualifiedName: value.qualifiedName,
        };
    }

    if (key === "$type") return value;
    if (key === "$cstNode") {
        if (!value) return;
        const cst = value as CstNode;
        return simplifyCstNode(cst);
    }

    // skip implementation/internal members
    if (key.startsWith("$") || key.startsWith("_")) return;

    if (isElementReference(value)) {
        // serialize human readable data for references, also avoid circular
        // dependencies in AST
        const target = value.$meta.to.target?.qualifiedName ?? null;
        return {
            $type: value.$type,
            $cstNode: value.$cstNode,
            text: value.$cstNode?.text,
            reference: target,
            parts: value.parts.map((ref) => ref.ref?.$meta.qualifiedName),
        };
    }

    return value;
}

function toJSONImpl(
    item: unknown,
    key: string,
    value: unknown,
    replacer: (this: unknown, key: string, value: unknown) => unknown
): unknown {
    if (typeof item !== "object" || !item) return item;

    // JSON.stringify handles .toJSON implicitly
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#description
    if ("toJSON" in item && item.toJSON instanceof Function) item = item.toJSON(key);

    item = replacer.call(item, key, value);

    if (typeof item !== "object" || !item || item instanceof Function || item instanceof Symbol)
        return item;

    if (Array.isArray(item)) {
        return item
            .map((value, index) => toJSONImpl(item, index.toString(), value, replacer))
            .filter((v) => v !== undefined);
    }

    const out: Record<string, unknown> = {};
    for (const key in item) {
        if (typeof key !== "string") continue;
        // TS doesn't allow indexing by a key from `in`????
        const value = (item as Record<string, unknown>)[key];
        const replaced = toJSONImpl(item, key, value, replacer);
        if (replaced === undefined) continue;
        out[key] = replaced;
    }

    return out;
}

/**
 * Prepare {@link item} for JSON serialization through a {@link replacer}
 * @see {@link JSON.stringify}
 * @param item item to convert to JSON value
 * @param replacer object replacer
 * @returns JSON compatible value provided {@link replacer} correctly handles
 * circular references
 */
export function toJSON(
    item: unknown,
    replacer: (this: unknown, key: string, value: unknown) => unknown
): unknown {
    return toJSONImpl(item, "", item, replacer);
}

/**
 * Basic conversion to string based on JSON that works for AST nodes
 */
export function stringify(node: unknown, indent = 2): string {
    if (typeof node !== "object") return JSON.stringify(node);
    return JSON.stringify(node, JSONreplacer, indent);
}

/**
 * Unions of types that JSON supports by default
 */
export type JSONType = number | null | string | boolean | object | [] | undefined;

/**
 * Interface for objects that can be converted to JSON compatible object
 */
export interface JSONConvertible<T extends JSONType = JSONType> {
    toJSON(): T;
}

export function isJSONConvertible(item: unknown): item is JSONConvertible {
    return (
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).toJSON instanceof Function
    );
}

export type RecordKey = string | number | symbol;

/**
 * Keys of {@link T} that extend {@link V}
 */
export type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

/**
 * Keys of {@link T} that can be assigned {@link V}
 */
export type AssignableKeys<T, V> = { [K in keyof T]-?: V extends T[K] ? K : never }[keyof T];

/**
 * A very simple timer
 */
export class Timer {
    private start: number;
    constructor() {
        this.start = performance.now();
    }

    /**
     * @returns Time elapsed in ms since construction or last {@link reset}
     */
    elapsed(): number {
        return performance.now() - this.start;
    }

    /**
     * Reset timer start point
     */
    reset(): void {
        this.start = performance.now();
    }
}

/**
 * Individual statistic tracker
 */
class StatisticsCounter {
    private timer = new Timer();
    private elapsed = 0;
    private hits = 0;

    enter(): void {
        this.timer.reset();
    }

    exit(suspend = false): void {
        this.elapsed += this.timer.elapsed();
        if (!suspend) this.hits++;
    }

    reset(): void {
        this.elapsed = 0;
        this.hits = 0;
    }

    timeSpent(): number {
        return this.elapsed;
    }

    timesEntered(): number {
        return this.hits;
    }
}

/**
 * Timed statistics tracker
 */
export class Statistics {
    private stats: Record<string, StatisticsCounter> = {};
    private stack: StatisticsCounter[] = [];

    /**
     * Start timing {@link name}, suspends an active timer if one exists
     * @param name Individual statistic name
     */
    enter(name: string): void {
        let counter = this.stats[name];
        if (!counter) {
            counter = new StatisticsCounter();
            this.stats[name] = counter;
        }

        if (this.stack.length > 0) {
            // suspend previous method
            this.stack[this.stack.length - 1].exit(true);
        }

        this.stack.push(counter);
        counter.enter();
    }

    /**
     * Stop timing {@link name}, continues the last timer if one exists
     * @param name Individual statistic name
     */
    exit(name: string): void {
        this.stats[name]?.exit();
        this.stack.pop();

        if (this.stack.length > 0) {
            // reenter suspended method
            this.stack[this.stack.length - 1].enter();
        }
    }

    /**
     * Collect all statistics
     * @returns A record of statistic names to a tuple of [time elapsed, times
     * entered]
     */
    dump(): Record<string, [number, number]> {
        const out: Record<string, [number, number]> = {};
        for (const [name, counter] of Object.entries(this.stats)) {
            out[name] = [counter.timeSpent(), counter.timesEntered()];
        }

        return out;
    }

    /**
     * Clear statistics
     */
    reset(): void {
        this.stats = {};
    }

    /**
     *
     * @returns true if there are any statistics collected, false otherwise
     */
    isEmpty(): boolean {
        return Object.keys(this.stats).length === 0;
    }

    /**
     * Current depth of {@link enter}/{@link exit} statistics, only the last one
     * is timed while the rest are suspended
     */
    get currentDepth(): number {
        return this.stack.length;
    }
}

/**
 * Merge two objects recursively
 * @param left Object with default values
 * @param right Object with overwriting values
 * @returns Combined object of {@link left} and {@link right} with values
 * overwritten by {@link right}
 */
export function mergeWithPartial<T>(left: T, right?: DeepPartial<T>): T {
    if (typeof left !== "object" || left === null) return (right ?? left) as T;
    if (right === undefined) return left;

    if (Array.isArray(left)) {
        // shallow copies on arrays
        return right as T;
    }

    const rhs = right as Record<string, unknown>;
    const out: Record<string, unknown> = { ...rhs };
    for (const [key, value] of Object.entries(left)) {
        if (key in rhs) {
            out[key] = mergeWithPartial(value, rhs[key]);
        } else {
            out[key] = value;
        }
    }

    return out as T;
}

/**
 *
 * @param v
 * @returns true is {@link v} is a power of 2, false otherwise
 */
export function isPowerOf2(v: number): boolean {
    return v !== 0 && !(v & (v - 1));
}

export function flagNames(v: number, names: Map<number, string>): string[] {
    if (v == 0) return [];

    const name = names.get(v);
    if (name) return [name]; // existing member

    // most likely a combination -> decompose
    const flags: string[] = [];
    for (const [flag, name] of names.entries()) {
        // only use distinct flags in decomposition
        if (!isPowerOf2(flag)) continue;
        if ((v & flag) === v) {
            flags.push(name);
        }
    }
    return flags;
}

/**
 * Convert {@link v} to a string of flags
 * @param v Value
 * @param names Map of flag values to names
 * @returns string representation of the flags
 */
export function stringifyFlags(v: number, names: Map<number, string>): string {
    return flagNames(v, names).join(" | ");
}

/**
 * Remove {@link value} from {@link array}
 * @param array Array to erase {@link value} from
 * @param value Value to erase from {@link array}
 * @returns {@link array}
 */
export function erase<T>(array: T[], value: T): T[] {
    const index = array.indexOf(value);
    if (index < 0) return array;
    return array.splice(index, 1);
}

/**
 * Turn a synchronous while loop into an asynchronous one with {@link condition}
 * checked every {@link period} ms
 * @param condition While loop condition, loop until it returns false
 * @param timing
 * @param timing.timeout Timeout in ms
 * @param timing.period {@link condition} checking period in ms
 * @param cancelToken cancelation token
 * @returns
 */
export async function asyncWaitWhile(
    condition: () => boolean,
    { timeout = undefined, period = 1 }: { timeout?: number; period?: number } = {},
    cancelToken = CancellationToken.None
): Promise<void> {
    let end: number | undefined;
    if (timeout) {
        const start = performance.now();
        end = start + timeout;
    }

    return new Promise((resolve, reject) => {
        const check = (): void => {
            if (!condition()) resolve();
            else if (end && performance.now() > end) reject(OperationCancelled);
            else if (cancelToken.isCancellationRequested) reject(OperationCancelled);
            else setTimeout(check, period);
        };

        check();
    });
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type DeepReadonly<T> = T extends Function
    ? T
    : {
          readonly [P in keyof T]: DeepReadonly<T[P]>;
      };

// eslint-disable-next-line @typescript-eslint/ban-types
export type DeepRequired<T> = T extends Function
    ? T
    : {
          [P in keyof T]-?: DeepRequired<T[P]>;
      };

/**
 * Make only properties matching K partial
 */
export type PartialKeys<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

/**
 * Backtrack to a parent directory matching {@link dirname}
 * @param p starting directory
 * @param dirname parent directory base name or a {@link RegExp} matching a
 * basename
 * @returns parent directory with basename matching {@link dirname} if exists,
 * otherwise undefined
 */
export function backtrackToDirname(p: string, dirname: string | RegExp): string | undefined {
    for (;;) {
        const name = path.basename(p);
        if (typeof dirname === "string") {
            if (name === dirname) return p;
        } else if (dirname.test(name)) return p;

        const prev = path.join(p, "..");
        if (prev === p) {
            // reached root dir, avoid infinite loop
            return;
        }

        p = prev;
    }
}

/**
 * Wait until all promises have resolved/rejected and report rejection reasons
 * @param value promises to wait on
 * @param onRejected rejection message generator
 * @returns resolved values
 */
export async function waitAllPromises<T>(
    value: Iterable<T | PromiseLike<T>>,
    onRejected?: (result: PromiseRejectedResult, index: number) => string
): Promise<T[]> {
    const resolved: T[] = [];

    await Promise.allSettled(value).then((results) => {
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                let message =
                    onRejected?.call(undefined, result, index) ??
                    `Promise failed: ${result.reason}`;
                if (result.reason instanceof Error) message += "\n" + result.reason.stack;
                console.error(message);
            } else {
                resolved.push(result.value);
            }
        });
    });

    return resolved;
}

/**
 * Decorator to mark properties and fields as enumerable. Such members may then
 * included in `for ... in` iteration depending on their enumerability. Note
 * that properties by default are non-enumerable.
 *
 * Single value overload allows specifying enumerability value.
 *
 * @see
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
 */
export function enumerable(target: object, name: string | symbol): void;
export function enumerable(
    target: object,
    name: string | symbol,
    descriptor: PropertyDescriptor
): void;
// `MethodDecorator` and `PropertyDecorator` generate TS errors when used with fields...
export function enumerable(value: boolean): typeof enumerable;

export function enumerable(
    targetOrValue: object | boolean,
    name?: string | symbol,
    descriptor?: PropertyDescriptor
): void | MethodDecorator | PropertyDecorator {
    const decorator = function (
        target: object,
        name: string | symbol,
        descriptor?: PropertyDescriptor
    ): void {
        const enumerable = targetOrValue as boolean;
        if (descriptor) {
            descriptor.enumerable = enumerable;
            return;
        }

        // fields are enumerable by default, no need to overwrite them
        if (enumerable) return;
        let value: unknown = undefined;
        Object.defineProperty(target, name, {
            configurable: true,
            enumerable,
            get() {
                return value;
            },
            set(v) {
                value = v;
            },
        });
    };

    if (name) {
        decorator(targetOrValue as object, name as string, descriptor);
        return;
    }

    return decorator;
}

export type LazyGetter<T> = () => T;

export const NonNullable = <T>(item: T | undefined | null): item is T => Boolean(item);

export function getDocument(element: BasicMetamodel): LangiumDocument | undefined {
    let ast: AstNode | undefined;
    let current: Metamodel | undefined = element;
    while (current) {
        ast = current.ast();
        if (ast) break;
        current = current.parent();
    }

    while (ast) {
        if (!ast.$container) break;
        ast = ast.$container;
    }

    return ast?.$document;
}
