/******************************************************************************
 * This file was generated by langium-cli 0.5.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

import { LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumSharedServices, LangiumServices, LanguageMetaData, Module, IParserConfig } from 'langium';
import { SysMlAstReflection } from './ast';
import { KerMLGrammar, SysMLGrammar } from './grammar';

export const KerMLLanguageMetaData: LanguageMetaData = {
    languageId: 'kerml',
    fileExtensions: ['.kerml'],
    caseInsensitive: false
};

export const SysMLLanguageMetaData: LanguageMetaData = {
    languageId: 'sysml',
    fileExtensions: ['.sysml'],
    caseInsensitive: false
};

export const parserConfig: IParserConfig = {
    recoveryEnabled: true,
    nodeLocationTracking: 'none',
};

export const SysMlGeneratedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
    AstReflection: () => new SysMlAstReflection()
};

export const KerMLGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Grammar: () => KerMLGrammar(),
    LanguageMetaData: () => KerMLLanguageMetaData,
    parser: {
        ParserConfig: () => parserConfig
    }
};

export const SysMLGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Grammar: () => SysMLGrammar(),
    LanguageMetaData: () => SysMLLanguageMetaData,
    parser: {
        ParserConfig: () => parserConfig
    }
};
