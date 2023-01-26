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

import { DeepPartial, LangiumServices, LangiumSharedServices } from "langium";
import { AstNodeLocator } from "langium/lib/workspace/ast-node-locator";
import { MetamodelBuilder } from "./shared/workspace/metamodel-builder";
import { SysMLParser } from "./parser/parser";
import { SysMLConfig } from "./config";
import { ModelLevelExpressionEvaluator } from "../model/expressions/util";
import { Statistics } from "../utils/common";
import { SysMLLanguageServer } from "./lsp/language-server";
import { SysMLDocumentFactory } from "./shared/workspace/documents";
import { SysMLConfigurationProvider } from "./shared/workspace/configuration-provider";
import { SysMLIndexManager } from "./shared/workspace/index-manager";
import { SysMLScopeProvider } from "./references/scope-provider";
import { SysMLDocumentBuilder } from "./shared/workspace/document-builder";
import { KerMLValidator } from "./validation/kerml-validator";
import { SysMLValidator } from "./validation/sysml-validator";
import { SysMLAstReflection } from "./sysml-ast-reflection";
import { SysMLLinker } from "./references/linker";
import { SysMLNodeDescriptionProvider } from "./shared/workspace/ast-descriptions";
import { SysMLScopeComputation } from "./references/scope-computation";
import { SysMLFileSystemProvider } from "./shared/workspace/file-system-provider";

export type SysMLAddedSharedServices = {
    workspace: {
        // locator and description provider should definitely be shared since
        // different languages use the same AST
        AstNodeLocator: AstNodeLocator;
        AstNodeDescriptionProvider: SysMLNodeDescriptionProvider;
        MetamodelBuilder: MetamodelBuilder;
        LangiumDocumentFactory: SysMLDocumentFactory;
        ConfigurationProvider: SysMLConfigurationProvider;
        IndexManager: SysMLIndexManager;
        DocumentBuilder: SysMLDocumentBuilder;
        FileSystemProvider: SysMLFileSystemProvider;
    };
    lsp: {
        LanguageServer: SysMLLanguageServer;
    };
    config: SysMLConfig;
    modelLevelExpressionEvaluator: ModelLevelExpressionEvaluator;
    statistics: Statistics;
    AstReflection: SysMLAstReflection;
};
export type SysMLSharedServices = LangiumSharedServices & SysMLAddedSharedServices;

/**
 * Declaration of custom services - add your own service classes here.
 */
export type SysMLDefaultAddedServices = {
    parser: {
        LangiumParser: SysMLParser;
    };
    references: {
        ScopeProvider: SysMLScopeProvider;
        ScopeComputation: SysMLScopeComputation;
        Linker: SysMLLinker;
    };
    workspace: {
        AstNodeDescriptionProvider: SysMLNodeDescriptionProvider;
    };
    shared: SysMLSharedServices;
};
export type KerMLAddedServices = {
    validation: {
        KerMLValidator: KerMLValidator;
    };
};

export type SysMLAddedServices = {
    validation: {
        SysMLValidator: SysMLValidator;
    };
};

/**
 * Union of Langium default services and your custom services - use this as
 * constructor parameter of custom service classes.
 */
export type SysMLDefaultServices = LangiumServices & SysMLDefaultAddedServices;
export type SysMLServices = SysMLDefaultServices & SysMLAddedServices;
export type KerMLServices = SysMLDefaultServices & KerMLAddedServices;

export type PartialSysMLDefaultServices = DeepPartial<SysMLDefaultServices>;
