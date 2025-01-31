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

import tjs from "typescript-json-schema";
import ts from "typescript";
import fs from "fs-extra";
import path from "path";

// optionally pass argument to schema generator
/** @type {tjs.PartialArgs} */
const settings = {
    required: true,
    // default TS compiler fails when invoked by the generator, ignore errors
    ignoreErrors: true,
    // cannot have refs, VS Code doesn't support them
    ref: false,
};

const files = [path.resolve("./src/configuration-schema.ts")];

// using window for now since language server is launched per window
// rather than per machine
const ServerScope = "window";

/**
 *
 * @param {tjs.DefinitionOrBoolean} schema
 * @param {string} property
 * @returns {boolean}
 */
function hasProperty(schema, property) {
    if (typeof schema !== "object") return false;
    if (schema.properties && property in schema.properties) return true;
    if (schema.allOf && schema.allOf.some((s) => hasProperty(s, property))) return true;
    if (schema.anyOf && schema.anyOf.some((s) => hasProperty(s, property))) return true;
    if (schema.oneOf && schema.oneOf.some((s) => hasProperty(s, property))) return true;
    if (schema.then && hasProperty(schema.then, property)) return true;
    if (schema.else && hasProperty(schema.else, property)) return true;
    return false;
}

/**
 *
 * @param {tjs.Definition} schema
 * @param {string[]} stack
 * @returns {[string, tjs.DefinitionOrBoolean][]}
 */
function flattenSchema(schema, stack = []) {
    if (!schema.properties) return [[stack.join("."), schema]];

    // forward description to preservable formatting members
    if (hasProperty(schema, "fallback"))
        Object.values(schema.properties ?? {}).forEach((prop) => {
            if (typeof prop === "boolean") return;
            prop.description = `${schema.description}\n\n${prop.description}`;
        });

    return Object.entries(schema.properties).flatMap(([name, prop]) => {
        if (typeof prop === "boolean") return [[...stack, name].join("."), prop];
        return flattenSchema(prop, [...stack, name]);
    });
}

/**
 *
 * @param {object} left
 * @param {object} right
 * @returns object
 */
function merge(left, right) {
    if (right === null) return left;
    if (!left) left = {};
    for (const [key, value] of Object.entries(right)) {
        if (typeof value === "object" && !Array.isArray(value)) left[key] = merge(left[key], value);
        else left[key] = value;
    }
    return left;
}

/**
 *
 * @returns {Promise<void>}
 */
async function main() {
    // load TS config
    const filename = ts.findConfigFile("../", ts.sys.fileExists, "tsconfig.json");
    if (!filename) return;
    const config = ts.readConfigFile(filename, ts.sys.readFile);
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, ".");
    const program = tjs.getProgramFromFiles(files, options.options, ".");

    // create schema generator
    const generator = tjs.buildGenerator(program, settings, files);
    if (!generator) return;

    // load package.json for editing
    const cfg = JSON.parse(await fs.readFile("package.json", "utf-8"));

    // generate schema for configuration
    let schema = tjs.generateSchema(program, "ConfigurationSchema", settings, files, generator);
    const properties = cfg.contributes.configuration.properties;
    if (schema) {
        for (const [name, prop] of flattenSchema(schema, ["syside"])) {
            properties[name] = merge(cfg.contributes.configuration.properties[name], prop);
            if (!("scope" in properties[name])) properties[name].scope = ServerScope;
        }
    }

    // save package.json
    await fs.writeFile("package.json", JSON.stringify(cfg, undefined, 4) + "\n");
}

main();
