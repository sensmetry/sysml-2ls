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

/**
 * Trim an annotation body as it was parsed by removing terminators and
 * potentially leading * characters on each line
 * @param body annotation body string as it was parsed
 * @param isMarkdown if true, trim {@link body} for markdown presentation -
 * preserve whitespace and the end of each line
 * @returns trimmed annotation body
 */
export function prettyAnnotationBody(body: string, isMarkdown = true): string {
    body = body.trim();
    body = body.replace("/*", "").trimStart();
    if (body.endsWith("*/")) body = body.substring(0, body.length - 2).trimEnd();

    const lines = body.split(/\r?\n/);

    lines.forEach((line, index) => {
        // trailing whitespace has meaning in markdown
        line = isMarkdown ? line.trimLeft() : line.trim();
        if (line.startsWith("*")) {
            line = line.replace(/^\* ?/, "");
        }

        lines[index] = line;
    });

    return lines.join("\n");
}
