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

/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { extractDocument } from "./cli-util";
import { CommandOptions } from "commander";
import {
    StandardLibrary,
    createSysMLServices,
    stringify,
    ast,
    KerMLLanguageMetaData,
    SysMLLanguageMetaData,
} from "syside-languageserver";
import { SysMLNodeFileSystem } from "syside-languageserver/node";
// import chalk from 'chalk';

interface Options extends CommandOptions {
    validate: boolean;
    stdlib: StandardLibrary;
}

export const Extensions = KerMLLanguageMetaData.fileExtensions.concat(
    SysMLLanguageMetaData.fileExtensions
);

export const evalAction = async (fileName: string, options: Options): Promise<void> => {
    const services = createSysMLServices(SysMLNodeFileSystem).KerML;
    const document = await extractDocument<ast.Namespace>(fileName, Extensions, services, {
        validate: options.validate,
        standardLibrary: options.stdlib,
    });
    const module = document.parseResult.value;
    console.log(stringify(module));
};
