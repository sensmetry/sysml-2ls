#!/usr/bin/env node

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

import { Command } from "commander";
import fs from "fs-extra";
import path from "path";
import process from "process";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * @typedef {[number, number, number]} Version
 */

/**
 * @param {string} version
 * @returns {Version | undefined}
 */
function parseVersion(version) {
    const matches = SEMVER.exec(version.trim());
    if (!matches) return;

    return [Number.parseInt(matches[1]), Number.parseInt(matches[2]), Number.parseInt(matches[3])];
}

/**
 *
 * @param {Version} a
 * @param {Version} b
 * @returns {number}
 */
function compareVersions(a, b) {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
}

/**
 *
 * @param {string} packageJson
 * @param {string} version
 * @returns {Promise<void>}
 */
async function bumpVersion(packageJson, version) {
    fs.readJSON(packageJson, "utf-8").then((json) => {
        json.version = version;
        return fs.writeJSON(packageJson, json, { encoding: "utf-8", spaces: 4 });
    });
}

/**
 *
 * @returns {Promise<string[]>}
 */
async function collectSubpackages() {
    const root = path.resolve("packages");
    return fs
        .readdir(root, "utf-8")
        .then((items) => items.map((item) => path.join(root, item)))
        .then((items) =>
            items.map((item) =>
                fs.stat(item).then(
                    (stat) => [item, stat],
                    /* ignore stat errors */
                    () => [item, undefined]
                )
            )
        )
        .then((promises) => Promise.all(promises))
        .then((items) => items.filter(([_, stat]) => stat?.isDirectory()))
        .then((items) => items.map(([p]) => p));
}

/**
 *
 * @returns {Promise<void>}
 */
async function main() {
    const program = new Command();

    program
        .argument("<version>", "Release version")
        .option("-o, --out [changelog]", "Output current changelog to file", undefined);
    program.parse(process.argv);

    const args = program.args;
    const options = program.opts();

    // remove potentially leading "v"
    let version = args[0];
    if (version.startsWith("v")) version = version.substring(1);

    const newVersion = parseVersion(version);

    if (!newVersion) {
        console.error(`Expected semver version but got ${version}`);
        process.exit(1);
    }

    const config = await fs.readJSON("package.json");
    const lastVersion = parseVersion(config.version);
    if (lastVersion && compareVersions(newVersion, lastVersion) <= 0) {
        console.error(`Expected a version greater than ${config.version} but got ${version}`);
        process.exit(1);
    }

    // Update package.json in workspace
    await Promise.all([
        bumpVersion("package.json", version),
        collectSubpackages()
            .then((paths) => paths.map((p) => path.join(p, "package.json")))
            .then((paths) =>
                paths.map((p) =>
                    fs.exists(p).then((exists) => (exists ? bumpVersion(p, version) : null))
                )
            ),
    ]);

    // Update changelog
    let changelog = await fs.readFile("CHANGELOG.md", "utf-8");

    // regex for release section
    const regex = /(?<!#)## ([^\r\n]*)/g;
    const match = regex.exec(changelog);

    // bail-out if not not found or the first changelog section already has a different semver
    if (!match) return;
    const changelogVersion = parseVersion(match[1].trim());
    if (changelogVersion && compareVersions(changelogVersion, newVersion) !== 0) {
        console.error(`Changelog already contains changes for a different version: ${match[1]}`);
        process.exit(1);
    }

    const current = match.index;
    const currentEnd = regex.lastIndex;

    const previous = regex.exec(changelog)?.index ?? changelog.length;

    if (options.out) {
        // current changelog is between the first 2 sections
        const latest = changelog.substring(currentEnd, previous).trim() + "\n";
        await fs.writeFile(options.out, latest);
    }

    changelog = changelog.substring(0, current) + `## main\n\n## ${version}` + changelog.substring(currentEnd);
    await fs.writeFile("CHANGELOG.md", changelog);
}

main();
