/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as extract from 'extract-zip';
import * as fse from 'fs-extra';
import * as path from 'path';
// tslint:disable-next-line:no-require-imports
import request = require('request-promise');
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import TelemetryReporter from 'vscode-extension-telemetry';
import { ScriptProjectCreatorBase } from '../commands/createNewProject/ScriptProjectCreatorBase';
import { ProjectLanguage, ProjectRuntime, TemplateFilter } from '../constants';
import { localize } from '../localize';
import { Config } from './Config';
import { ConfigBinding } from './ConfigBinding';
import { ConfigSetting } from './ConfigSetting';
import { Resources } from './Resources';
import { Template, TemplateCategory } from './Template';

const templatesKey: string = 'FunctionTemplates';
const configKey: string = 'FunctionTemplateConfig';
const resourcesKey: string = 'FunctionTemplateResources';

/**
 * Main container for all template data retrieved from the Azure Functions Portal. See README.md for more info and example of the schema.
 * We cache the template data retrieved from the portal so that the user can create functions offline.
 */
export class TemplateData {
    private readonly _templatesMap: { [runtime: string]: Template[] } = {};
    private readonly _configMap: { [runtime: string]: Config } = {};

    private readonly _verifiedTemplates: string[] = [
        'BlobTrigger-JavaScript',
        'GenericWebHook-JavaScript',
        'GitHubWebHook-JavaScript',
        'HttpTrigger-JavaScript',
        'HttpTriggerWithParameters-JavaScript',
        'ManualTrigger-JavaScript',
        'QueueTrigger-JavaScript',
        'TimerTrigger-JavaScript'
    ];

    private readonly _cSharpTemplates: string[] = [
        'HttpTrigger-CSharp',
        'BlobTrigger-CSharp',
        'QueueTrigger-CSharp',
        'TimerTrigger-CSharp'
    ];

    private readonly _javaTemplates: string[] = [
        'HttpTrigger',
        'BlobTrigger',
        'QueueTrigger',
        'TimerTrigger'
    ];

    constructor(templatesMap: { [runtime: string]: Template[] }, configMap: { [runtime: string]: Config }) {
        for (const verifiedTemplateId of this._verifiedTemplates) {
            if (!templatesMap[ScriptProjectCreatorBase.defaultRuntime].some((t: Template) => t.id === verifiedTemplateId)) {
                throw new Error(localize('failedToFindJavaScriptTemplate', 'Failed to find verified template with id "{0}".', verifiedTemplateId));
            }
        }

        for (const verifiedTemplateId of this._cSharpTemplates) {
            if (!templatesMap[ProjectRuntime.one].some((t: Template) => t.id === verifiedTemplateId) || !templatesMap[ProjectRuntime.beta].some((t: Template) => t.id === verifiedTemplateId)) {
                throw new Error(localize('failedToFindCSharpTemplate', 'Failed to find verified template with id "{0}".', verifiedTemplateId));
            }
        }

        this._templatesMap = templatesMap;
        this._configMap = configMap;
    }

    public async getTemplates(language: string, runtime: string = ProjectRuntime.one, templateFilter?: string): Promise<Template[]> {
        if (language === ProjectLanguage.Java) {
            // Currently we leverage JS templates to get the function metadata of Java Functions.
            // Will refactor the code here when templates HTTP API is ready.
            // See issue here: https://github.com/Microsoft/vscode-azurefunctions/issues/84
            const javaTemplates: Template[] = this._templatesMap[runtime].filter((t: Template) => t.language === ProjectLanguage.JavaScript);
            return javaTemplates.filter((t: Template) => this._javaTemplates.find((vt: string) => vt === removeLanguageFromId(t.id)));
        } else if (language === ProjectLanguage.CSharp) {
            // https://github.com/Microsoft/vscode-azurefunctions/issues/179
            return this._templatesMap[runtime].filter((t: Template) => this._cSharpTemplates.some((id: string) => id === t.id));
        } else {
            switch (language) {
                case ProjectLanguage.CSharpScript:
                case ProjectLanguage.FSharpScript:
                    // The functions portal only supports script languages, so it doesn't have the notion of 'C#' vs 'C#Script'
                    language = language.replace('Script', '');
                    break;
                default:
            }

            let templates: Template[] = this._templatesMap[runtime].filter((t: Template) => t.language.toLowerCase() === language.toLowerCase());
            switch (templateFilter) {
                case TemplateFilter.All:
                    break;
                case TemplateFilter.Core:
                    templates = templates.filter((t: Template) => t.isCategory(TemplateCategory.Core));
                    break;
                case TemplateFilter.Verified:
                default:
                    templates = templates.filter((t: Template) => this._verifiedTemplates.find((vt: string) => vt === t.id));
            }

            return templates;
        }
    }

    public async getSetting(runtime: ProjectRuntime, bindingType: string, settingName: string): Promise<ConfigSetting | undefined> {
        const binding: ConfigBinding | undefined = this._configMap[runtime].bindings.find((b: ConfigBinding) => b.bindingType === bindingType);
        if (binding) {
            return binding.settings.find((bs: ConfigSetting) => bs.name === settingName);
        } else {
            return undefined;
        }
    }
}

export async function tryGetTemplateDataFromCache(reporter: TelemetryReporter | undefined, globalState: vscode.Memento): Promise<TemplateData | undefined> {
    try {
        return <TemplateData | undefined>await callWithTelemetryAndErrorHandling('azureFunctions.tryGetTemplateDataFromCache', reporter, undefined, async function (this: IActionContext): Promise<TemplateData | undefined> {
            this.suppressErrorDisplay = true;
            this.properties.isActivationEvent = 'true';
            const templatesMap: { [runtime: string]: Template[] } = {};
            const configMap: { [runtime: string]: Config } = {};

            for (const key of Object.keys(ProjectRuntime)) {
                const runtime: ProjectRuntime = <ProjectRuntime>ProjectRuntime[key];
                const cachedResources: object | undefined = globalState.get<object>(getRuntimeKey(resourcesKey, runtime));
                const cachedTemplates: object[] | undefined = globalState.get<object[]>(getRuntimeKey(templatesKey, runtime));
                const cachedConfig: object | undefined = globalState.get<object>(getRuntimeKey(configKey, runtime));

                if (cachedResources && cachedTemplates && cachedConfig) {
                    [templatesMap[runtime], configMap[runtime]] = parseTemplates(cachedResources, cachedTemplates, cachedConfig);
                } else {
                    return undefined;
                }
            }

            return new TemplateData(templatesMap, configMap);
        });
    } catch (error) {
        return undefined;
    }
}

export async function tryGetTemplateDataFromFuncPortal(reporter: TelemetryReporter | undefined, globalState?: vscode.Memento, hostname: string = 'functions.azure.com'): Promise<TemplateData | undefined> {
    try {
        return <TemplateData>await callWithTelemetryAndErrorHandling('azureFunctions.tryGetTemplateDataFromFuncPortal', reporter, undefined, async function (this: IActionContext): Promise<TemplateData> {
            this.suppressErrorDisplay = true;
            this.properties.isActivationEvent = 'true';
            const templatesMap: { [runtime: string]: Template[] } = {};
            const configMap: { [runtime: string]: Config } = {};

            for (const key of Object.keys(ProjectRuntime)) {
                const runtime: ProjectRuntime = <ProjectRuntime>ProjectRuntime[key];
                const rawResources: object = await requestFunctionPortal<object>(hostname, 'resources', runtime);
                const rawTemplates: object[] = await requestFunctionPortal<object[]>(hostname, 'templates', runtime);
                const rawConfig: object = await requestFunctionPortal<object>(hostname, 'bindingconfig', runtime);

                [templatesMap[runtime], configMap[runtime]] = parseTemplates(rawResources, rawTemplates, rawConfig);

                if (globalState) {
                    globalState.update(getRuntimeKey(templatesKey, runtime), rawTemplates);
                    globalState.update(getRuntimeKey(configKey, runtime), rawConfig);
                    globalState.update(getRuntimeKey(resourcesKey, runtime), rawResources);
                }
            }

            return new TemplateData(templatesMap, configMap);
        });
    } catch (error) {
        return undefined;
    }
}

export async function getTemplateDataFromBackup(reporter: TelemetryReporter | undefined, extensionPath: string): Promise<TemplateData> {
    return <TemplateData>await callWithTelemetryAndErrorHandling('azureFunctions.getTemplateDataFromBackup', reporter, undefined, async function (this: IActionContext): Promise<TemplateData | undefined> {
        this.suppressErrorDisplay = true;
        this.properties.isActivationEvent = 'true';
        const templatesMap: { [runtime: string]: Template[] } = {};
        const configMap: { [runtime: string]: Config } = {};

        for (const key of Object.keys(ProjectRuntime)) {
            const runtime: ProjectRuntime = <ProjectRuntime>ProjectRuntime[key];
            const templatePath: string = path.join(extensionPath, 'resources', 'templates', runtime);
            const rawResources: object = <object>await fse.readJSON(path.join(templatePath, 'resources.json'));
            const rawTemplates: object[] = <object[]>await fse.readJSON(path.join(templatePath, 'templates.json'));
            const rawConfig: object = <object>await fse.readJSON(path.join(templatePath, 'bindingconfig.json'));

            [templatesMap[runtime], configMap[runtime]] = parseTemplates(rawResources, rawTemplates, rawConfig);
        }

        return new TemplateData(templatesMap, configMap);
    });
}

function getRuntimeKey(baseKey: string, runtime: ProjectRuntime): string {
    return runtime === ProjectRuntime.one ? baseKey : `${baseKey}.${runtime}`;
}

async function requestFunctionPortal<T>(version: string, subpath: string, runtime: string, param?: string): Promise<T> {
    const funcJsonOptions: request.OptionsWithUri = {
        method: 'GET',
        uri: `https://functionscdn.azureedge.net/public/cli-feed-v3.json`,
        headers: {
            'User-Agent': 'Mozilla/5.0' // Required otherwise we get Unauthorized
        }
    };

    const funcJson: T = <T>(JSON.parse(await <Thenable<string>>request(funcJsonOptions).promise()));
    const releaseUrl: string = funcJson.releases['2.0.1-beta.25'];
    const templateUrl: string = releaseUrl.projectTemplates;

    const templateOptions: request.OptionsWithUri = {
        method: 'GET',
        uri: templateUrl,
        headers: {
            'User-Agent': 'Mozilla/5.0' // Required otherwise we get Unauthorized
        }
    };

    const templates: T = await <Thenable<string>>request(templateOptions).promise();
    console.log(templates);

    return <T>(JSON.parse(await <Thenable<string>>request(templateOptions).promise()));
}

function parseTemplates(rawResources: object, rawTemplates: object[], rawConfig: object): [Template[], Config] {
    const resources: Resources = new Resources(rawResources);
    const templates: Template[] = [];
    for (const rawTemplate of rawTemplates) {
        try {
            templates.push(new Template(rawTemplate, resources));
        } catch (error) {
            // Ignore errors so that a single poorly formed template does not affect other templates
        }
    }
    return [templates, new Config(rawConfig, resources)];
}

export function removeLanguageFromId(id: string): string {
    return id.split('-')[0];
}
