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

import { DeepPartial, DefaultConfigurationProvider } from "langium";
import { DidChangeConfigurationNotification } from "vscode-languageserver";
import { mergeWithPartial } from "../../../utils/common";
import { SysMLConfig } from "../../config";
import { LanguageConfig, LanguageEvents, SharedEvents } from "../../events";
import { SysMLDefaultServices, SysMLSharedServices } from "../../services";
import { SysMLFileSystemProvider } from "./file-system-provider";

export const SETTINGS_KEY = "syside.editor";

export class SysMLConfigurationProvider extends DefaultConfigurationProvider {
    protected readonly services: SysMLSharedServices;
    protected readonly configChanged: SharedEvents["onConfigurationChanged"];
    protected readonly languageConfigChanged: Record<
        string,
        LanguageEvents["onConfigurationChanged"]
    >;
    private fs: SysMLFileSystemProvider;

    constructor(services: SysMLSharedServices) {
        super(services);
        this.fs = services.workspace.FileSystemProvider;

        this.updateStdlibPath(services.config);

        this.services = services;
        this.configChanged = services.Events.onConfigurationChanged;
        this.languageConfigChanged = Object.fromEntries(
            services.ServiceRegistry.all.map((services) => [
                this.toSectionName(services.LanguageMetaData.languageId),
                (services as SysMLDefaultServices).Events.onConfigurationChanged,
            ])
        );
        this.settings[SETTINGS_KEY] = services.config;
        services.lsp.LanguageServer.onInitialized((_params) => {
            services.lsp.Connection?.client.register(DidChangeConfigurationNotification.type, {
                section: SETTINGS_KEY,
            });
        });
    }

    protected override async initialize(): Promise<void> {
        await super.initialize();

        // als initialize the language server config
        if (this.workspaceConfig && this.connection) {
            const config = await this.connection.workspace.getConfiguration({
                section: SETTINGS_KEY,
            });
            this.updateSectionConfiguration(SETTINGS_KEY, config);
        }
    }

    async firstTimeSetup(): Promise<void> {
        if (!this.initialized) await this.initialize();
    }

    /**
     * Get a specific language server configuration option
     * @param key key of {@link SysMLConfig}
     * @returns config value corresponding to {@link key}
     */
    getOption<K extends keyof SysMLConfig>(key: K): SysMLConfig[K] {
        return this.get()[key];
    }

    /**
     * @returns Most recent language server configuration
     */
    get(): SysMLConfig {
        return this.settings[SETTINGS_KEY] as SysMLConfig;
    }

    protected override updateSectionConfiguration(section: string, configuration: unknown): void {
        const old = this.settings[section];
        if (section === SETTINGS_KEY) {
            // don't change the config if none was received
            if (!configuration) return;
            // not all settings may be exposed through package.json so get those
            // settings values from the default config

            const updated = mergeWithPartial<SysMLConfig>(
                this.services.config,
                configuration as DeepPartial<SysMLConfig>
            );

            super.updateSectionConfiguration(section, updated);
            this.updateStdlibPath(updated);
            this.configChanged.emit(old as SysMLConfig, updated);
        } else {
            super.updateSectionConfiguration(section, configuration);
        }

        this.languageConfigChanged[section]?.emit(old, configuration as LanguageConfig);
    }

    private updateStdlibPath(config: SysMLConfig): void {
        const stdPath = config.standardLibraryPath;
        this.fs.updateStandardLibrary(stdPath);
    }

    protected override toSectionName(languageId: string): string {
        // VS Code uses [langId] for language specific settings
        return languageId === SETTINGS_KEY ? languageId : `[${languageId}]`;
    }
}
