/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProjectRuntime } from '../constants';
import { ext } from '../extensionVariables';
import { dotnetUtils } from '../utils/dotnetUtils';
import { downloadFile } from '../utils/fs';
import { cliFeedJsonResponse } from '../utils/getCliFeedJson';
import { executeDotnetTemplateCommand, getDotnetItemTemplatePath, getDotnetProjectTemplatePath } from './executeDotnetTemplateCommand';
import { IFunctionTemplate } from './IFunctionTemplate';
import { parseDotnetTemplates } from './parseDotnetTemplates';
import { TemplateRetriever, TemplateType } from './TemplateRetriever';

export class DotnetTemplateRetriever extends TemplateRetriever {
    public templateType: TemplateType = TemplateType.Dotnet;
    private _dotnetTemplatesKey: string = 'DotnetTemplates';
    private _rawTemplates: object[];

    public getVerifiedTemplateIds(runtime: ProjectRuntime): string[] {
        return getDotnetVerifiedTemplateIds(runtime);
    }

    protected async getTemplatesFromCache(runtime: ProjectRuntime): Promise<IFunctionTemplate[] | undefined> {
        const cachedDotnetTemplates: object[] | undefined = ext.context.globalState.get<object[]>(this.getCacheKey(this._dotnetTemplatesKey, runtime));
        if (cachedDotnetTemplates) {
            return parseDotnetTemplates(cachedDotnetTemplates, runtime);
        } else {
            return undefined;
        }
    }

    protected async getTemplatesFromCliFeed(cliFeedJson: cliFeedJsonResponse, templateVersion: string, runtime: ProjectRuntime): Promise<IFunctionTemplate[]> {
        await dotnetUtils.validateDotnetInstalled();

        const projectFilePath: string = getDotnetProjectTemplatePath(runtime);
        await downloadFile(cliFeedJson.releases[templateVersion].projectTemplates, projectFilePath);

        const itemFilePath: string = getDotnetItemTemplatePath(runtime);
        await downloadFile(cliFeedJson.releases[templateVersion].itemTemplates, itemFilePath);

        this._rawTemplates = <object[]>JSON.parse(await executeDotnetTemplateCommand(runtime, undefined, 'list'));
        return parseDotnetTemplates(this._rawTemplates, runtime);
    }

    protected async cacheTemplatesFromCliFeed(runtime: ProjectRuntime): Promise<void> {
        ext.context.globalState.update(this.getCacheKey(this._dotnetTemplatesKey, runtime), this._rawTemplates);
    }
}

export function getDotnetVerifiedTemplateIds(runtime: string): string[] {
    let verifiedTemplateIds: string[] = [
        'HttpTrigger',
        'BlobTrigger',
        'QueueTrigger',
        'TimerTrigger'
    ];

    if (runtime === ProjectRuntime.one) {
        verifiedTemplateIds = verifiedTemplateIds.concat([
            'GenericWebHook',
            'GitHubWebHook',
            'HttpTriggerWithParameters'
        ]);
    }

    return verifiedTemplateIds.map((id: string) => {
        id = `Azure.Function.CSharp.${id}`;
        switch (runtime) {
            case ProjectRuntime.one:
                return `${id}.1.x`;
            case ProjectRuntime.beta:
                return `${id}.2.x`;
            default:
                throw new RangeError();
        }
    });
}
