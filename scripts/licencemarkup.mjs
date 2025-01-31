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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const separator = `\n${"-".repeat(3)}\n\n`;
/**
 * @param {string} text
 */
function toBlockQuote(text) {
    return text
        .trim()
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
}

/**
 * @param {import("rollup-plugin-license").Dependency[]} dependencies
 */
async function getLicenseText(dependencies) {
    let ROOT_PATH = path.join(fileURLToPath(import.meta.url), "..", "..");
    const LICENSE = fs.readFileSync(path.join(ROOT_PATH, "LICENSE"), "utf8");

    dependencies = dependencies.filter(
        (dependency, index) =>
            // Exclude ourself
            !dependency.name.startsWith("syside") &&
            // Unique by `name` and `version`
            index ===
                dependencies.findIndex(
                    ({ name, version }) =>
                        dependency.name === name && dependency.version === version
                )
    );

    dependencies.sort(
        (dependencyA, dependencyB) =>
            dependencyA.name.localeCompare(dependencyB.name) ||
            dependencyA.version.localeCompare(dependencyB.version)
    );

    const licenses = [
        ...new Set(dependencies.filter(({ license }) => license).map(({ license }) => license)),
    ];

    const text = `${LICENSE.trim()}`;

    if (licenses.length === 0) {
        return text;
    }

    const parts = [
        text,
        `## Licenses of bundled dependencies\n\nThe published SysIDE artifact additionally contains code with the following licenses:\n${licenses.join(", ")}`,
    ];

    const content = dependencies
        .map((dependency) => {
            let text = `### ${dependency.name}@v${dependency.version}\n`;

            const meta = [];

            if (dependency.description) {
                meta.push(toBlockQuote(dependency.description) + "\n");
            }

            if (dependency.license) {
                meta.push(`License: ${dependency.license}` + "  ");
            }
            if (dependency.homepage) {
                meta.push(`Homepage: <${dependency.homepage}>` + "  ");
            }
            if (dependency.repository?.url) {
                meta.push(`Repository: <${dependency.repository.url}>` + "  ");
            }
            if (dependency.author) {
                meta.push(`Author: ${dependency.author.text()}` + "  ");
            }
            if (dependency.contributors?.length > 0) {
                const contributors = dependency.contributors
                    .map((contributor) => ` - ${contributor.text()}` + "  ")
                    .join("\n");

                meta.push(`Contributors:\n${contributors}` + "  ");
            }

            if (meta.length > 0) {
                text += "\n" + meta.join("\n") + "\n";
            }

            if (dependency.licenseText) {
                text += "\n" + toBlockQuote(dependency.licenseText) + "\n";
            }
            return text;
        })
        .join(separator);

    return [...parts, `## Bundled dependencies\n\n${content}`].join("\n\n");
}

export { getLicenseText };
