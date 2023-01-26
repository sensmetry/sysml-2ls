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

type Groups = { [group: string]: string[] };
type Prefixes = { [name: string]: string };

// each group maps to an array of singular rules
type ExpandedGroups = Map<string, string[]>;

// expand nested rule groups so that groups contain only singular rules
export function expandGroups(unexpanded: Groups): ExpandedGroups {
    const out: ExpandedGroups = new Map();

    const collectGroup = function (group: string) {
        let items = out.get(group);
        if (items) return items;
        items = [];
        for (const item of unexpanded[group]) {
            if (item in unexpanded) items.push(...collectGroup(item));
            else {
                items.push(item);
            }
        }

        out.set(group, items);

        return items;
    };

    for (const group of Object.keys(unexpanded)) {
        collectGroup(group);
    }

    return out;
}

// each group maps to a map of prefixes to a set of rules with the same prefix
type CollectedGroups = Map<string, Map<string, Set<string>>>;

// collect rules in groups based on prefixes
export function collectGroups(
    groups: ExpandedGroups,
    prefixes: { [name: string]: string }
): CollectedGroups {
    const out: CollectedGroups = new Map();

    const getPrefix = function (item: string): string {
        while (item in prefixes) {
            item = prefixes[item];
        }

        return item;
    };

    for (const [group, rules] of groups.entries()) {
        const map = new Map<string, Set<string>>();
        for (const rule of rules) {
            const prefix = getPrefix(rule);
            let array = map.get(prefix);
            if (!array) {
                array = new Set();
                map.set(prefix, array);
            }
            array.add(rule);
        }

        out.set(group, map);
    }

    return out;
}

export function setEq<T>(lhs: Set<T>, rhs: Set<T>): boolean {
    return lhs.size === rhs.size && [...lhs].every((v) => rhs.has(v));
}

export function setCompare<T>(lhs: Set<T>, rhs: Set<T>): number | undefined {
    // -1: lhs < rhs, 0: lhs = rhs, 1: lhs > rhs
    if (lhs.size === rhs.size) return setEq(lhs, rhs) ? 0 : undefined;
    if (lhs.size < rhs.size) return [...lhs].every((v) => rhs.has(v)) ? -1 : undefined;
    return [...rhs].every((v) => lhs.has(v)) ? 1 : undefined;
}

type CommonGroup = {
    name: string;
    rules: Set<string>;
};

type Grouping = { [group: string]: Map<string, string> } & { groups: Map<string, CommonGroup[]> };

// collect identical sets of rules and only leave group rules with references to
// common sets
export function gatherCommonGroups(groups: CollectedGroups): Grouping {
    const out: Record<string, Map<string, unknown>> = {};
    const common = new Map<string, CommonGroup[]>();
    let count = 0;

    for (const [group, ruleMap] of groups.entries()) {
        const map = new Map<string, string>();

        for (const [prefix, rules] of ruleMap.entries()) {
            let commonGroups = common.get(prefix);
            if (!commonGroups) {
                commonGroups = [];
                common.set(prefix, commonGroups);
            }

            // merge with an equal rule set
            let match: CommonGroup | undefined;
            for (const commonGroup of commonGroups) {
                if (setEq(commonGroup.rules, rules)) {
                    match = commonGroup;
                    break;
                }
            }

            if (!match) {
                // create a new rule set
                match = {
                    name: `Group_${count++}`,
                    rules: rules,
                };
                commonGroups.push(match);
            }
            map.set(prefix, match.name);
        }

        out[group] = map;
    }

    (out as Grouping).groups = common;
    return out as Grouping;
}

// replace subsets of rules with other rules
export function mergeGroups(groups: CommonGroup[]): CommonGroup[] {
    // sort by size in ascending order first for easier iteration
    groups.sort((l, r) => l.rules.size - r.rules.size);

    // iterating from the largest set to the smallest so that smaller sets don't
    // have references to other sets
    for (let i = groups.length - 1; i >= 0; --i) {
        const group = groups[i];
        for (let j = i - 1; j >= 0; --j) {
            // only need to check if a smaller rule set is a subset of the
            // current set if so, replace the rules with a reference to the
            // subset. May not be optimal overall but it is enough
            if (setCompare(groups[j].rules, group.rules) === -1) {
                // group is a superset of groups[j]
                const subgroup = groups[j];
                group.rules = new Set([...group.rules].filter((rule) => !subgroup.rules.has(rule)));
                group.rules.add(subgroup.name);
            }
        }
    }

    return groups;
}

// simplify common rule sets by factoring out common subsets
export function simplifyGroups(grouping: Grouping): Grouping {
    for (const [prefix, commonGroups] of grouping.groups) {
        grouping.groups.set(prefix, mergeGroups(commonGroups));
    }

    return grouping;
}

export function JSONreplacer(_: unknown, v: unknown) {
    if (v instanceof Map) {
        const out: Record<string, unknown> = {};
        for (const [key, value] of v.entries()) out[key] = value;
        return out;
    }
    if (v instanceof Set) {
        return Array.from(v);
    }
    return v;
}

type ProcessedGroups = {
    prefixes: Prefixes;
    groups: Record<string, Map<string, string>>;
    sets: Map<string, CommonGroup[]>;
};

export function processGroups(
    groups: Groups,
    rulePrefixes: Prefixes,
    prefixes: Prefixes
): ProcessedGroups {
    const expanded = expandGroups(groups);
    const collected = collectGroups(expanded, rulePrefixes);
    const gathered = gatherCommonGroups(collected);
    const merged = simplifyGroups(gathered);

    const out: ProcessedGroups = { prefixes: prefixes, sets: merged.groups, groups: { ...merged } };
    delete out.groups.groups;
    return out;
}

export function generateGrammarGroups(groups: ProcessedGroups): string[] {
    const lines: string[] = [];

    for (const [group, rules] of Object.entries(groups.groups)) {
        lines.push(`// TODO: ${group}`);
        for (const [prefix, rule] of rules.entries()) {
            lines.push(`//    ${prefix}: ${rule}`);
        }
        lines.push("");
    }

    for (const [prefix, commonGroups] of groups.sets.entries()) {
        for (const commonGroup of commonGroups) {
            lines.push(`// ${prefix}`);
            lines.push(`fragment ${commonGroup.name}:`);
            let i = 0;
            for (const rule of commonGroup.rules) {
                lines.push(`    ${i !== 0 ? "|" : ""} ${rule}`);
                ++i;
            }
            lines.push(";\n");
        }
    }

    return lines;
}

import fs from "fs";

export function outputGroups(
    groups: Groups,
    rulePrefixes: Prefixes,
    prefixes: Prefixes,
    filename?: string
) {
    const processed = processGroups(groups, rulePrefixes, prefixes);

    const json = JSON.stringify(processed, JSONreplacer, 2);

    if (filename) fs.writeFileSync(filename, json);
    else console.log(json);
}
