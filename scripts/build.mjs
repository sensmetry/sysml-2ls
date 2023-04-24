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

import { Argument, Command } from "commander";
import * as esbuild from "esbuild";
import * as fs from "node:fs";

/* eslint-disable @typescript-eslint/explicit-function-return-type */
/** @type {esbuild.Plugin} */
const BuildWatcher = {
    name: "Build Watcher",
    setup(build) {
        build.onStart(() => {
            console.log("Build started");
        });
        build.onEnd((result) => {
            console.log(
                `Build ended with ${result.warnings.length} warnings and ${result.errors.length} errors`
            );
        });
    },
};

/** @type {esbuild.Plugin} */
const LLStarAmbiguityReport = {
    name: "LLStarAmbiguityReport",
    setup(build) {
        build.onLoad({ filter: /langium-parser.js/ }, async (args) => {
            const contents = await fs.promises.readFile(args.path, "utf-8").then((contents) => {
                // removes the ambiguity logger since it's more suited for
                // development than release
                return contents.replace(
                    "LLStarLookaheadStrategy()",
                    `LLStarLookaheadStrategy({
                        logging: (message) => {}
                    })`
                );
            });

            return {
                contents,
                loader: "js",
            };
        });
    },
};

/** @type {esbuild.BuildOptions} */
let options = {
    bundle: true,
    external: ["vscode"],
    write: true,
    outdir: "./out",
    plugins: [BuildWatcher, LLStarAmbiguityReport],
};

/** @type {Record<string, (entries: string[]) => esbuild.BuildOptions>} */
let builds = {
    node: (entries) => ({
        ...options,
        platform: "node",
        format: "cjs",

        entryPoints: entries,
    }),
};

const program = new Command();
program
    .addArgument(
        new Argument("<TARGET>", "Build target").choices(Object.keys(builds)).argRequired()
    )
    .addArgument(
        (() => {
            const arg = new Argument("<entry>", "entry point").argRequired();
            arg.variadic = true;
            return arg;
        })()
    )
    .option("--watch", "Run in watch mode", false)
    .option("--sourcemap", "Generate source maps", false)
    .option("--minify", "Minify generated files", false);
program.parse();

const opts = program.opts();

const ctx = await (opts.watch ? esbuild.context : esbuild.build)({
    ...builds[program.args[0]](program.args.slice(1)),
    sourcemap: opts.sourcemap,
    minify: opts.minify,
});

if (opts.watch) {
    await ctx.watch();
    console.log("watching...");
}
