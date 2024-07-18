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

import { Argument, Command, Option } from "commander";
import * as esbuild from "esbuild";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";
import path from "node:path";
import plugin from "node-stdlib-browser/helpers/esbuild/plugin";
import stdLibBrowser from "node-stdlib-browser";
import { createRequire } from "node:module";
import rollupPluginLicense from "rollup-plugin-license";
import { getLicenseText } from "./licencemarkup.mjs";

const require = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/explicit-function-return-type */
/** @type {esbuild.Plugin} */
export const BuildWatcher = {
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

/**
 * @typedef {import("rollup-plugin-license").Dependency} Dependency
 */

/** @type {esbuild.Plugin} */
export const LicenseBundler = {
    name: "License bundler",
    setup(build) {
        build.onEnd(async (result) => {
            const chunk = {
                modules: Object.fromEntries(
                    Object.keys(result.metafile.inputs).map((file) => [file, { renderedLength: 1 }])
                ),
            };

            /** @type { Dependency[]} */
            let dependencies;
            const plugin = rollupPluginLicense({
                thirdParty: {
                    includePrivate: true,
                    output(_dependencies) {
                        dependencies = _dependencies;
                    },
                },
            });
            plugin.renderChunk("", chunk);
            plugin.generateBundle();
            let txt = await getLicenseText(dependencies);
            fs.writeFileSync(
                path.join(path.dirname(Object.keys(result.metafile.outputs)[0]), "LICENSE"),
                txt
            );
        });
    },
};

/** @type {esbuild.Plugin} */
export const LLStarAmbiguityReport = {
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
export const Options = {
    bundle: true,
    external: ["vscode"],
    write: true,
    outdir: "./out",
    metafile: true,
    plugins: [BuildWatcher, LLStarAmbiguityReport, LicenseBundler],
};

/** @type {Record<string, (entries: string[]) => esbuild.BuildOptions>} */
export const Builds = {
    node: (entries) => ({
        ...Options,
        platform: "node",
        format: "cjs",

        entryPoints: entries,
    }),

    browser: (entries) => ({
        ...Options,
        platform: "browser",
        // iife doesn't work in VSCode
        format: "cjs",

        entryPoints: entries,
        inject: [require.resolve("node-stdlib-browser/helpers/esbuild/shim")],
        define: {
            global: "global",
            process: "process",
            Buffer: "Buffer",
        },
        plugins: [
            ...Options.plugins,
            plugin(stdLibBrowser),
            {
                name: "fetch-shim",
                setup(build) {
                    build.onResolve({ filter: /^node-fetch$/ }, (args) => {
                        return { path: args.path, namespace: "fetch" };
                    });

                    build.onLoad({ filter: /./, namespace: "fetch" }, (args) => {
                        return {
                            contents: "module.exports = fetch",
                            loader: "js",
                        };
                    });
                },
            },
            {
                // For some reason ESBuild resolves to UMD by default which may
                // use `require` which only works with "vscode" literal on the
                // web. Thankfully, ESM version is also bundled which doesn't
                // use `require` anywhere.
                name: "vscode-umd-redirect",
                setup(build) {
                    build.onResolve(
                        {
                            filter: /vscode-(languageserver-(types|textdocument)|uri)/,
                            namespace: "file",
                        },
                        async (args) => {
                            const result = await build.resolve(args.path, {
                                importer: args.importer,
                                kind: args.kind,
                                // different namespace to avoid infinite resolve
                                // loops
                                namespace: "redirect",
                                pluginData: args.pluginData,
                                resolveDir: args.resolveDir,
                            });

                            if (result.errors.length > 0) {
                                return { errors: result.errors };
                            }

                            return { ...result, path: result.path.replace("/umd", "/esm") };
                        }
                    );
                },
            },
        ],
    }),
};

/**
 *
 * @param  {...esbuild.Plugin} plugins
 */
export async function run(...plugins) {
    Options.plugins.push(...plugins);

    const program = new Command();
    program
        .addArgument(
            new Argument("<TARGET>", "Build target").choices(Object.keys(Builds)).argRequired()
        )
        .addArgument(
            (() => {
                const arg = new Argument("<entry>", "entry point").argRequired();
                arg.variadic = true;
                return arg;
            })()
        )
        .option("--watch", "Run in watch mode", false)
        .addOption(
            new Option("--sourcemap [inline]", "Generate source maps")
                .default(false)
                .choices(["inline"])
        )
        .option("--minify", "Minify generated files", false)
        .option("-o, --outdir <outdir>", "Output directory", "./out")
        .option(
            "-n, --name <name>",
            "Output file name. Cannot use with more than one entry. Resolved relative to outdir"
        );
    program.parse();

    const opts = program.opts();

    if (opts.name && program.args.length > 2) {
        throw new Error("Invalid file argument, cannot use with more than one entry");
    }

    /**
     * @type {esbuild.BuildOptions}
     */
    const args = {
        ...Builds[program.args[0]](program.args.slice(1)),
        sourcemap: opts.sourcemap,
        minify: opts.minify,
        outdir: opts.outdir,
    };

    if (opts.name) {
        args.outfile = path.resolve(args.outdir, opts.name);
        args.outdir = undefined;
    }

    const ctx = await (opts.watch ? esbuild.context : esbuild.build)(args);

    if (opts.watch) {
        await ctx.watch();
        console.log("watching...");
    }
}

if (fileURLToPath(import.meta.url) === (await fs.promises.realpath(process.argv[1]))) {
    run();
}
