/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { AppServicePlan, Site, WebAppCollection } from "azure-arm-website/lib/models";
import { createFunctionApp, IAppCreateOptions, SiteClient } from 'vscode-azureappservice';
import { AzureTreeItem, createAzureClient, createTreeItemsWithErrorHandling, IActionContext, parseError, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { ProjectLanguage, projectLanguageSetting, ProjectRuntime, projectRuntimeSetting } from '../constants';
import { tryGetLocalRuntimeVersion } from '../funcCoreTools/tryGetLocalRuntimeVersion';
import { localize } from "../localize";
import { convertStringToRuntime, getFuncExtensionSetting } from '../ProjectSettings';
import { getCliFeedAppSettings } from '../utils/getCliFeedJson';
import { FunctionAppTreeItem } from "./FunctionAppTreeItem";

export class FunctionAppProvider extends SubscriptionTreeItem {
    public readonly childTypeLabel: string = localize('azFunc.FunctionApp', 'Function App');

    private _nextLink: string | undefined;

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = createAzureClient(this.root, WebSiteManagementClient);
        let webAppCollection: WebAppCollection;
        try {
            webAppCollection = this._nextLink === undefined ?
                await client.webApps.list() :
                await client.webApps.listNext(this._nextLink);
        } catch (error) {
            if (parseError(error).errorType.toLowerCase() === 'notfound') {
                // This error type means the 'Microsoft.Web' provider has not been registered in this subscription
                // In that case, we know there are no function apps, so we can return an empty array
                // (The provider will be registered automatically if the user creates a new function app)
                return [];
            } else {
                throw error;
            }
        }

        this._nextLink = webAppCollection.nextLink;

        return await createTreeItemsWithErrorHandling(
            this,
            webAppCollection,
            'azFuncInvalidFunctionApp',
            async (site: Site) => {
                const siteClient: SiteClient = new SiteClient(site, this.root);
                if (siteClient.isFunctionApp) {
                    const asp: AppServicePlan | undefined = await siteClient.getAppServicePlan();
                    const isLinuxPreview: boolean = siteClient.kind.toLowerCase().includes('linux') && !!asp && !!asp.sku && !!asp.sku.tier && asp.sku.tier.toLowerCase() === 'dynamic';
                    return new FunctionAppTreeItem(this, siteClient, isLinuxPreview);
                }
                return undefined;
            },
            (site: Site) => {
                return site.name;
            }
        );
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, userOptions?: { actionContext: IActionContext, resourceGroup?: string }): Promise<AzureTreeItem> {
        // Ideally actionContext should always be defined, but there's a bug with the NodePicker. Create a 'fake' actionContext until that bug is fixed
        // https://github.com/Microsoft/vscode-azuretools/issues/120
        // tslint:disable-next-line:strict-boolean-expressions
        const actionContext: IActionContext = userOptions ? userOptions.actionContext : <IActionContext>{ properties: {}, measurements: {} };
        const resourceGroup: string | undefined = userOptions ? userOptions.resourceGroup : undefined;
        const runtime: ProjectRuntime = await getDefaultRuntime(actionContext);
        const functionAppSettings: { [key: string]: string } = await getCliFeedAppSettings(runtime);
        const language: string | undefined = getFuncExtensionSetting(projectLanguageSetting);
        const createOptions: IAppCreateOptions = { functionAppSettings, resourceGroup };

        // There are two things in preview right now:
        // 1. Python support
        // 2. Linux support
        // Python only works on Linux, so we have to use Linux when creating a function app. For other languages, we will stick with Windows until Linux GA's
        if (language === ProjectLanguage.Python) {
            createOptions.os = 'linux';
            createOptions.runtime = 'python';
        } else {
            createOptions.os = 'windows';
            // WEBSITE_RUN_FROM_PACKAGE has several benefits, so make that the default
            // https://docs.microsoft.com/en-us/azure/azure-functions/run-functions-from-deployment-package
            functionAppSettings.WEBSITE_RUN_FROM_PACKAGE = '1';
        }

        const site: Site = await createFunctionApp(actionContext, this.root, createOptions, showCreatingTreeItem);
        return new FunctionAppTreeItem(this, new SiteClient(site, this.root), createOptions.os === 'linux' /* isLinuxPreview */);
    }
}

async function getDefaultRuntime(actionContext: IActionContext): Promise<ProjectRuntime> {
    // Try to get VS Code setting for runtime (aka if they have a project open)
    let runtime: string | undefined = convertStringToRuntime(getFuncExtensionSetting(projectRuntimeSetting));
    actionContext.properties.runtimeSource = 'VSCodeSetting';

    if (!runtime) {
        // Try to get the runtime that matches their local func cli version
        runtime = await tryGetLocalRuntimeVersion();
        actionContext.properties.runtimeSource = 'LocalFuncCli';
    }

    if (!runtime) {
        // Default to v2 if all else fails
        runtime = ProjectRuntime.v2;
        actionContext.properties.runtimeSource = 'Backup';
    }

    actionContext.properties.projectRuntime = runtime;

    return <ProjectRuntime>runtime;
}
