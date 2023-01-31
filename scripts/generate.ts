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
import { spawn, execSync, ExecSyncOptions } from "child_process";
import CONFIG from "../package.json";

const GENERATE = "file:node_modules/langium-workspaces/packages/langium";
const RUNTIME = CONFIG.dependencies.langium;

const CHILD_OPTIONS: ExecSyncOptions = {
    stdio: [0, 1, 2],
};

async function generate(watch = false): Promise<void> {
    const install = (pack: string): void => {
        execSync(`pnpm install langium@${pack}`, CHILD_OPTIONS);
    };

    let reverted = false;
    const revert = (): void => {
        if (reverted) return;
        reverted = true;
        install(RUNTIME);
    };

    const args = [
        "tsx",
        "node_modules/langium-workspaces/packages/langium-cli/bin/langium.js",
        "generate",
    ];

    if (watch) args.push("--watch");

    return new Promise((resolve, reject) => {
        install(GENERATE);
        const child = spawn("pnpm", args, CHILD_OPTIONS);

        child.on("spawn", () => {
            revert();
        });

        let exited = false;
        const onExit = (code: number | null, error: unknown): void => {
            revert();
            if (exited) return;
            exited = true;
            if (!code) {
                if (code === 0) resolve();
                else reject(code);
            } else reject(error);
        };

        child.on("error", (e) => {
            onExit(null, e);
        });

        child.on("exit", onExit);
    });
}

async function main(): Promise<void> {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require("../package.json").version);

    program.option("--watch", "Watch for file changes", false);
    program.parse(process.argv);

    const options = program.opts();
    await generate(options.watch);
}

main().catch((reason) => {
    console.error(`Langium generate failed with ${reason}`);
    if (reason instanceof Error) console.error(reason.stack);
    process.exit(-1);
});
