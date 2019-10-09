/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProjectRuntime } from '../constants';
import { ext, TemplateSource } from '../extensionVariables';
import { localize } from '../localize';
import { feedUtils } from './feedUtils';

export namespace cliFeedUtils {
    const funcCliFeedUrl: string = 'https://aka.ms/V00v5v';
    const v1DefaultNodeVersion: string = '6.5.0';
    const v2DefaultNodeVersion: string = '8.11.1';

    interface ICliFeed {
        tags: {
            [tag: string]: ITag;
        };
        releases: {
            [version: string]: IRelease;
        };
    }

    export interface IRelease {
        templateApiZip: string;
        itemTemplates: string;
        projectTemplates: string;
        FUNCTIONS_EXTENSION_VERSION: string;
        nodeVersion: string;
    }

    interface ITag {
        release: string;
        displayName: string;
        hidden: boolean;
    }

    export async function getLatestVersion(runtime: ProjectRuntime): Promise<string> {
        const cliFeed: ICliFeed = await getCliFeed();

        let tag: string;
        switch (runtime) {
            case ProjectRuntime.v2:
                tag = 'v2';
                break;
            case ProjectRuntime.v1:
                tag = 'v1';
                break;
            default:
                throw new RangeError(localize('invalidRuntime', 'Invalid runtime "{0}".', runtime));
        }

        tag = ext.templateProvider.templateSource === TemplateSource.Staging ? `${tag}-prerelease` : tag;

        return cliFeed.tags[tag].release;
    }

    export async function getRelease(templateVersion: string): Promise<IRelease> {
        const cliFeed: ICliFeed = await getCliFeed();
        return cliFeed.releases[templateVersion];
    }

    /**
     * Returns the app settings that should be used when creating or deploying to a Function App, based on runtime
     */
    export async function getAppSettings(projectRuntime: ProjectRuntime): Promise<{ [key: string]: string }> {
        let funcVersion: string;
        let nodeVersion: string;

        try {
            const cliFeed: ICliFeed = await getCliFeed();
            const release: string = await getLatestVersion(projectRuntime);
            funcVersion = cliFeed.releases[release].FUNCTIONS_EXTENSION_VERSION;
            nodeVersion = cliFeed.releases[release].nodeVersion;
        } catch {
            // ignore and use defaults
            funcVersion = projectRuntime;
            nodeVersion = projectRuntime === ProjectRuntime.v1 ? v1DefaultNodeVersion : v2DefaultNodeVersion;
        }

        return {
            FUNCTIONS_EXTENSION_VERSION: funcVersion,
            WEBSITE_NODE_DEFAULT_VERSION: nodeVersion
        };
    }

    async function getCliFeed(): Promise<ICliFeed> {
        return feedUtils.getJsonFeed(funcCliFeedUrl);
    }
}
