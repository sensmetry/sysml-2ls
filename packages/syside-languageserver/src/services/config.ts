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

import { DefaultFormatOptions, FormatOptions } from "../model";
import { DeepReadonly, DeepRequired } from "../utils/common";
import { SysMLBuildOptions } from "./shared/workspace/document-builder";

export interface DebugConfig {
    /**
     * Append elements in scope to linking errors
     */
    scopeInLinkingErrors?: "none" | "types" | "members";

    /**
     * Append stacktrace to thrown errors while resolving references
     */
    stacktraceInLinkingErrors: boolean;

    /**
     * Log linking order
     */
    linkingTrace: boolean;
}

export interface TraceConfig {
    /**
     * Server trace level, implicitly used by the default VS Code LanguageClient
     */
    server: "off" | "messages" | "verbose";
}

export interface SysMLConfig {
    /**
     * If true, parse the bundled standard library
     */
    standardLibrary: boolean;

    /**
     * If set, use this path to import standard library files
     */
    standardLibraryPath?: string;

    /**
     * Skip collecting files matching extensions in the current workspace on
     * startup
     */
    skipWorkspaceInit: boolean;

    /**
     * Debug options
     */
    debug: DebugConfig;

    /**
     * Default build options used if specific ones are not provided
     */
    defaultBuildOptions: DeepRequired<SysMLBuildOptions>;

    /**
     * If true, build times will be reported
     */
    logStatistics: boolean;

    /**
     * Trace options
     */
    trace: TraceConfig;

    /**
     * Additional plugin paths (.js scripts or directories with .js scripts)
     * that will be loaded on server start-up
     */
    plugins: string[];

    /** Formatting options. */
    formatting: FormatOptions;
}

export const DefaultDebugConfig: Readonly<DebugConfig> = {
    scopeInLinkingErrors: "none",
    stacktraceInLinkingErrors: true,
    linkingTrace: false,
};

export const DefaultBuildOptions: Readonly<Required<SysMLBuildOptions>> = {
    validationChecks: "all",
    ignoreMetamodelErrors: false,
    standardLibrary: "standard",
    standalone: false,
};

export const DefaultTraceConfig: Readonly<TraceConfig> = {
    server: "off",
};

export const DefaultSysMLConfig: DeepReadonly<SysMLConfig> = {
    standardLibrary: true,
    standardLibraryPath: undefined,
    skipWorkspaceInit: false,
    debug: DefaultDebugConfig,
    defaultBuildOptions: DefaultBuildOptions,
    logStatistics: true,
    trace: DefaultTraceConfig,
    plugins: [],
    formatting: DefaultFormatOptions,
};
