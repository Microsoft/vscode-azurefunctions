/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { ProjectRuntime } from '../constants';
import { ext, TemplateSource } from '../extensionVariables';
import { localize } from '../localize';
import { requestUtils } from './requestUtils';

const funcCliFeedUrl: string = 'https://aka.ms/V00v5v';
const v1DefaultNodeVersion: string = '6.5.0';
const v2DefaultNodeVersion: string = '8.11.1';

export type cliFeedJsonResponse = {
    tags: {
        [tag: string]: {
            release: string;
            displayName: string;
            hidden: boolean;
        };
    };
    releases: {
        [release: string]: {
            templateApiZip: string;
            itemTemplates: string;
            projectTemplates: string;
            FUNCTIONS_EXTENSION_VERSION: string;
            nodeVersion: string;
        };
    };
};

export async function tryGetCliFeedJson(): Promise<cliFeedJsonResponse | undefined> {
    return await callWithTelemetryAndErrorHandling('azureFunctions.tryGetCliFeedJson', async (context: IActionContext) => {
        context.telemetry.properties.isActivationEvent = 'true';
        context.errorHandling.suppressDisplay = true;
        context.telemetry.suppressIfSuccessful = true;
        return getCliFeedJson();
    });
}

export async function getCliFeedJson(): Promise<cliFeedJsonResponse> {
    const request: requestUtils.Request = await requestUtils.getDefaultRequest(funcCliFeedUrl);
    const response: string = await requestUtils.sendRequest(request);
    return <cliFeedJsonResponse>JSON.parse(response);
}

export function getFeedRuntime(runtime: ProjectRuntime): string {
    let result: string;
    switch (runtime) {
        case ProjectRuntime.v2:
            result = 'v2';
            break;
        case ProjectRuntime.v1:
            result = 'v1';
            break;
        default:
            throw new RangeError(localize('invalidRuntime', 'Invalid runtime "{0}".', runtime));
    }

    return ext.templateProvider.templateSource === TemplateSource.Staging ? `${result}-prerelease` : result;
}

/**
 * Returns the app settings that should be used when creating or deploying to a Function App, based on runtime
 */
export async function getCliFeedAppSettings(projectRuntime: ProjectRuntime): Promise<{ [key: string]: string }> {
    // Use these defaults in case we can't get the cli-feed
    let funcVersion: string = projectRuntime;
    let nodeVersion: string = projectRuntime === ProjectRuntime.v1 ? v1DefaultNodeVersion : v2DefaultNodeVersion;

    const cliFeed: cliFeedJsonResponse | undefined = await tryGetCliFeedJson();
    if (cliFeed) {
        const release: string = cliFeed.tags[getFeedRuntime(projectRuntime)].release;
        funcVersion = cliFeed.releases[release].FUNCTIONS_EXTENSION_VERSION;
        nodeVersion = cliFeed.releases[release].nodeVersion;
    }

    return {
        FUNCTIONS_EXTENSION_VERSION: funcVersion,
        WEBSITE_NODE_DEFAULT_VERSION: nodeVersion
    };
}
