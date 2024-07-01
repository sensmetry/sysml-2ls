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

import fs from "fs-extra";
import util from "util";
import child_process from "child_process";

const exec = util.promisify(child_process.exec);

const Repository = (lang) => ({
    strings: {
        patterns: [
            {
                name: `string.quoted.other.${lang}`,
                begin: "/\\*",
                beginCapture: {
                    0: {
                        name: `punctuation.definition.string.begin.${lang}`,
                    },
                },
                end: "\\*/",
                endCapture: {
                    0: {
                        name: `punctuation.definition.string.end.${lang}`,
                    },
                },
            },
            {
                name: `string.quoted.double.${lang}`,
                begin: '"',
                beginCapture: {
                    0: {
                        name: `punctuation.definition.string.begin.${lang}`,
                    },
                },
                end: '"',
                endCapture: {
                    0: {
                        name: `punctuation.definition.string.end.${lang}`,
                    },
                },
            },
        ],
    },
});
const Patterns = (lang) => [
    {
        include: "#strings",
    },
    {
        match: "\\b([1-9]+[0-9]*|0)",
        name: `constant.numeric.integer.decimal.${lang}`,
    },
    {
        match: "\\b(?i:(\\d+\\.\\d*(e[\\-\\+]?\\d+)?))(?=[^a-zA-Z_])",
        name: `constant.numeric.float.${lang}`,
    },
    {
        match: "(?<=[^0-9a-zA-Z_])(?i:(\\.\\d+(e[\\-\\+]?\\d+)?))",
        name: `constant.numeric.float.${lang}`,
    },
];

/**
 *
 * @param {string} filename
 * @param {string} lang
 */
async function updateTextMateGrammar(filename, lang) {
    let grammar = JSON.parse(await fs.readFile(filename, { encoding: "utf-8" }));

    grammar.patterns.push(...Patterns(lang));
    Object.assign(grammar.repository, Repository(lang));

    await fs.writeFile(filename, JSON.stringify(grammar, null, 2));
}

exec("pnpm run esbuild")
    .then(() =>
        Promise.all(
            [
                ["../../LICENSE", "LICENSE"],
                ["../../CHANGELOG.md", "CHANGELOG.md"],
                ["README.md", ".README"],
            ].map(([src, dst]) => fs.copyFile(src, dst))
        )
    )
    .then(() =>
        Promise.all([
            fs.copyFile("../../README.md", "README.md"),
            fs
                .mkdirp("icons")
                .then(() => fs.copyFile("../../docs/images/logo.png", "icons/logo.png")),
            fs.copy("../syside-languageserver/syntaxes", "syntaxes"),
        ])
    )
    .then(() =>
        Promise.all([
            updateTextMateGrammar("syntaxes/kerml.tmLanguage.json", "kerml"),
            updateTextMateGrammar("syntaxes/sysml.tmLanguage.json", "sysml"),
        ])
    );
