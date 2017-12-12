/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import request = require('request-promise');
import * as vscode from 'vscode';
import { localize } from '../localize';
import { Config } from './Config';
import { ConfigBinding } from './ConfigBinding';
import { ConfigSetting } from './ConfigSetting';
import { Resources } from './Resources';
import { Template, TemplateCategory, TemplateLanguage } from './Template';

/**
 * Main container for all template data retrieved from the Azure Functions Portal. See README.md for more info and example of the schema.
 * We cache the template data retrieved from the portal so that the user can create functions offline.
 */
export class TemplateData {
    private readonly _templateInitError: Error = new Error(localize('azFunc.TemplateInitError', 'Failed to retrieve templates from the Azure Functions Portal.'));
    private readonly _templatesKey: string = 'FunctionTemplates';
    private readonly _configKey: string = 'FunctionTemplateConfig';
    private readonly _resourcesKey: string = 'FunctionTemplateResources';
    private readonly _refreshTask: Promise<void>;
    private _templates: Template[] | undefined;
    private _config: Config | undefined;

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

    private readonly _javaTemplates: string[] = [
        'HttpTrigger',
        'BlobTrigger',
        'QueueTrigger',
        'TimerTrigger'
    ];

    constructor(globalState?: vscode.Memento) {
        if (globalState) {
            const cachedResources: object | undefined = globalState.get<object>(this._resourcesKey);
            const cachedTemplates: object[] | undefined = globalState.get<object[]>(this._templatesKey);
            const cachedConfig: object | undefined = globalState.get<object>(this._configKey);

            if (cachedResources && cachedTemplates && cachedConfig) {
                this.parseTemplates(cachedResources, cachedTemplates, cachedConfig);
            }
        }

        this._refreshTask = this.refreshTemplates(globalState);
    }

    public async getTemplates(language: string, templateFilter?: string): Promise<Template[]> {
        if (this._templates === undefined) {
            await this._refreshTask;
            if (this._templates === undefined) {
                throw this._templateInitError;
            }
        }

        if (language === TemplateLanguage.Java) {
            // Currently we leverage JS templates to get the function metadata of Java Functions.
            // Will refactor the code here when templates HTTP API is ready.
            // See issue here: https://github.com/Microsoft/vscode-azurefunctions/issues/84
            const javaTemplates: Template[] = this._templates.filter((t: Template) => t.language === TemplateLanguage.JavaScript);
            return javaTemplates.filter((t: Template) => this._javaTemplates.find((vt: string) => vt === convertTemplateIdToJava(t.id)));
        } else {
            const jsTemplates: Template[] = this._templates.filter((t: Template) => t.language === TemplateLanguage.JavaScript);
            switch (templateFilter) {
                case 'All':
                    return jsTemplates;
                case 'Core':
                    return jsTemplates.filter((t: Template) => t.isCategory(TemplateCategory.Core));
                case 'Verified':
                default:
                    return jsTemplates.filter((t: Template) => this._verifiedTemplates.find((vt: string) => vt === t.id));
            }
        }

    }

    public async getSetting(bindingType: string, settingName: string): Promise<ConfigSetting | undefined> {
        if (this._config === undefined) {
            await this._refreshTask;
            if (this._config === undefined) {
                throw this._templateInitError;
            }
        }

        const binding: ConfigBinding | undefined = this._config.bindings.find((b: ConfigBinding) => b.bindingType === bindingType);
        if (binding) {
            return binding.settings.find((bs: ConfigSetting) => bs.name === settingName);
        } else {
            return undefined;
        }
    }

    private async refreshTemplates(globalState?: vscode.Memento): Promise<void> {
        try {
            const rawResources: object = await this.requestFunctionPortal<object>('resources', 'name=en-us');
            const rawTemplates: object[] = await this.requestFunctionPortal<object[]>('templates');
            const rawConfig: object = await this.requestFunctionPortal<object>('bindingconfig');

            this.parseTemplates(rawResources, rawTemplates, rawConfig);

            if (globalState) {
                globalState.update(this._templatesKey, rawTemplates);
                globalState.update(this._configKey, rawConfig);
                globalState.update(this._resourcesKey, rawResources);
            }
        } catch (error) {
            // ignore errors - use cached version of templates instead
        }
    }

    private async requestFunctionPortal<T>(subPath: string, param?: string): Promise<T> {
        const options: request.OptionsWithUri = {
            method: 'GET',
            uri: `https://functions.azure.com/api/${subPath}?runtime=latest$&${param}`,
            headers: {
                'User-Agent': 'Mozilla/5.0' // Required otherwise we get Unauthorized
            }
        };

        return <T>(JSON.parse(await <Thenable<string>>request(options).promise()));
    }

    private parseTemplates(rawResources: object, rawTemplates: object[], rawConfig: object): void {
        const resources: Resources = new Resources(rawResources);
        this._templates = [];
        for (const rawTemplate of rawTemplates) {
            try {
                this._templates.push(new Template(rawTemplate, resources));
            } catch {
                // Ignore errors so that a single poorly formed template does not affect other templates
            }
        }
        this._config = new Config(rawConfig, resources);
    }
}

export function convertTemplateIdToJava(id: string): string {
    return id.replace('-JavaScript', '');
}
