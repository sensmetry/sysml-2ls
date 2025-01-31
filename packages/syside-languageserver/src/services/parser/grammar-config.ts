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

import { LangiumServices } from "langium";
import { isRegexToken } from "langium/lib/grammar/generated/ast";
import { createGrammarConfig, GrammarConfig } from "langium/lib/grammar/grammar-config";

// Cached grammar config since it is identical between KerML and SysML. May be
// helpful when/if we decide to create services per test case.
let SysMLGrammarConfig: GrammarConfig | undefined;

// Terminal rules used for names
const NAME_TERMINALS = ["ID", "UNRESTRICTED_NAME"] as const;

export function createSysMLGrammarConfig(services: LangiumServices): GrammarConfig {
    if (SysMLGrammarConfig) return SysMLGrammarConfig;

    const config = createGrammarConfig(services);
    const grammar = services.Grammar;

    let name = "";
    for (const terminal of NAME_TERMINALS) {
        const rule = grammar.rules.find((rule) => rule.name === terminal);

        // NB: this is not very robust to changes in the grammar files
        if (!rule || !isRegexToken(rule.definition)) continue;

        const regex = `^${rule.definition.regex}$`;
        if (name.length === 0) name = regex;
        else name += "|" + regex;
    }

    if (name.length > 0) config.nameRegexp = new RegExp(name);

    SysMLGrammarConfig = config;
    return config;
}
