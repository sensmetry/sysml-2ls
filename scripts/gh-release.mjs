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

import { Octokit } from "@octokit/rest";
import { Command, Option } from "commander";
import * as fs from "fs";
import path from "path";

const ORGANIZATION = "Sensmetry";
const REPO = "sysml-2ls";

async function main() {
    const command = new Command();

    command
        .addOption(new Option("-p, --pat <PAT>", "GitHub PAT").makeOptionMandatory(true))
        .addOption(new Option("-t, --tag <TAG>", "Tag for release").makeOptionMandatory(true))
        .option("-n, --notes <NOTES>", "Path to release notes")
        .addOption(
            (() => {
                const opt = new Option("-a, --asset <NAME=PATH>", "Release asset")
                    .argParser((value, previous) => {
                        const parts = value.split("=", 2);
                        if (parts.length === 1) {
                            parts.unshift(path.basename(value));
                        }

                        previous.push(parts);
                        return previous;
                    })
                    .default([]);
                opt.variadic = true;
                return opt;
            })()
        );

    command.parse();

    const options = command.opts();

    const octokit = new Octokit({
        auth: options.pat,
        userAgent: "SysIDE",

        baseUrl: "https://api.github.com",

        log: {
            debug: () => {
                /* empty */
            },
            info: () => {
                /* empty */
            },
            warn: console.warn,
            error: console.error,
        },
    });

    const body = options.notes ? await fs.promises.readFile(options.notes, "utf-8") : undefined;

    const result = await octokit.rest.repos.createRelease({
        owner: ORGANIZATION,
        repo: REPO,
        tag_name: options.tag,
        body,
        generate_release_notes: true,
    });

    await Promise.all(
        options.asset.map(async ([name, path]) => {
            return octokit.rest.repos.uploadReleaseAsset({
                owner: ORGANIZATION,
                repo: REPO,
                release_id: result.data.id,
                name,
                data: await fs.promises.readFile(path),
            });
        })
    );
}

main();
