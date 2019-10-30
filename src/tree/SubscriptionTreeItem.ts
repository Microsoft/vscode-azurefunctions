/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from 'azure-arm-website';
import { AppInsightsCreateStep, AppInsightsListStep, AppKind, IAppServiceWizardContext, setLocationsTask, SiteClient, SiteCreateStep, SiteHostingPlanStep, SiteNameStep, SiteOSStep, SiteRuntimeStep, WebsiteOS } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, createAzureClient, IActionContext, ICreateChildImplContext, INewStorageAccountDefaults, LocationListStep, parseError, ResourceGroupCreateStep, ResourceGroupListStep, StorageAccountCreateStep, StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication, SubscriptionTreeItemBase } from 'vscode-azureextensionui';
import { funcVersionSetting, ProjectLanguage, projectLanguageSetting } from '../constants';
import { tryGetLocalFuncVersion } from '../funcCoreTools/tryGetLocalFuncVersion';
import { FuncVersion, latestGAVersion, tryParseFuncVersion } from '../FuncVersion';
import { localize } from "../localize";
import { nonNullProp } from '../utils/nonNull';
import { getFunctionsWorkerRuntime, getWorkspaceSettingFromAnyFolder } from '../vsCodeConfig/settings';
import { ProductionSlotTreeItem } from './ProductionSlotTreeItem';
import { isProjectCV, isRemoteProjectCV } from './projectContextValues';

export interface ICreateFuntionAppContext extends ICreateChildImplContext {
    newResourceGroupName?: string;
}

export class SubscriptionTreeItem extends SubscriptionTreeItemBase {
    public readonly childTypeLabel: string = localize('FunctionApp', 'Function App in Azure');
    public supportsAdvancedCreation: boolean = true;

    private _nextLink: string | undefined;

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = createAzureClient(this.root, WebSiteManagementClient);
        let webAppCollection: WebSiteManagementModels.WebAppCollection;
        try {
            webAppCollection = this._nextLink === undefined ?
                await client.webApps.list() :
                await client.webApps.listNext(this._nextLink);
        } catch (error) {
            if (parseError(error).errorType.toLowerCase() === 'notfound') {
                // This error type means the 'Microsoft.Web' provider has not been registered in this subscription
                // In that case, we know there are no Function Apps, so we can return an empty array
                // (The provider will be registered automatically if the user creates a new Function App)
                return [];
            } else {
                throw error;
            }
        }

        this._nextLink = webAppCollection.nextLink;

        return await this.createTreeItemsWithErrorHandling(
            webAppCollection,
            'azFuncInvalidFunctionApp',
            async (site: WebSiteManagementModels.Site) => {
                const siteClient: SiteClient = new SiteClient(site, this.root);
                if (siteClient.isFunctionApp) {
                    return new ProductionSlotTreeItem(this, siteClient, site);
                }
                return undefined;
            },
            (site: WebSiteManagementModels.Site) => {
                return site.name;
            }
        );
    }

    public async createChildImpl(context: ICreateFuntionAppContext): Promise<AzureTreeItem> {
        const version: FuncVersion = await getDefaultFuncVersion(context);
        const language: string | undefined = getWorkspaceSettingFromAnyFolder(projectLanguageSetting);

        const wizardContext: IAppServiceWizardContext = Object.assign(context, this.root, {
            newSiteKind: AppKind.functionapp,
            resourceGroupDeferLocationStep: true
        });

        const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [];
        const executeSteps: AzureWizardExecuteStep<IAppServiceWizardContext>[] = [];
        promptSteps.push(new SiteNameStep());
        promptSteps.push(new SiteOSStep());
        promptSteps.push(new SiteHostingPlanStep());
        promptSteps.push(new SiteRuntimeStep());

        const storageAccountCreateOptions: INewStorageAccountDefaults = {
            kind: StorageAccountKind.Storage,
            performance: StorageAccountPerformance.Standard,
            replication: StorageAccountReplication.LRS
        };

        if (!context.advancedCreation) {
            wizardContext.useConsumptionPlan = true;
            wizardContext.newSiteRuntime = getFunctionsWorkerRuntime(language);
            if (wizardContext.newSiteRuntime) {
                wizardContext.newSiteOS = language === ProjectLanguage.Python ? WebsiteOS.linux : WebsiteOS.windows;
                setLocationsTask(wizardContext);
            }
            executeSteps.push(new ResourceGroupCreateStep());
            executeSteps.push(new StorageAccountCreateStep(storageAccountCreateOptions));
            executeSteps.push(new AppInsightsCreateStep());
        } else {
            promptSteps.push(new ResourceGroupListStep());
            promptSteps.push(new StorageAccountListStep(
                storageAccountCreateOptions,
                {
                    kind: [
                        StorageAccountKind.BlobStorage
                    ],
                    performance: [
                        StorageAccountPerformance.Premium
                    ],
                    replication: [
                        StorageAccountReplication.ZRS
                    ],
                    learnMoreLink: 'https://aka.ms/Cfqnrc'
                }
            ));
            promptSteps.push(new AppInsightsListStep());
        }
        LocationListStep.addStep(wizardContext, promptSteps);

        executeSteps.push(new SiteCreateStep(async (appSettingsContext): Promise<WebSiteManagementModels.NameValuePair[]> => await createFunctionAppSettings(appSettingsContext, version, language)));

        const title: string = localize('functionAppCreatingTitle', 'Create new Function App in Azure');
        const wizard: AzureWizard<IAppServiceWizardContext> = new AzureWizard(wizardContext, { promptSteps, executeSteps, title });

        await wizard.prompt();
        context.showCreatingTreeItem(nonNullProp(wizardContext, 'newSiteName'));
        context.telemetry.properties.os = wizardContext.newSiteOS;
        context.telemetry.properties.runtime = wizardContext.newSiteRuntime;
        if (!context.advancedCreation) {
            const newName: string | undefined = await wizardContext.relatedNameTask;
            if (!newName) {
                throw new Error(localize('noUniqueName', 'Failed to generate unique name for resources. Use advanced creation to manually enter resource names.'));
            }
            wizardContext.newResourceGroupName = context.newResourceGroupName || newName;
            wizardContext.newStorageAccountName = newName;
            wizardContext.newAppInsightsName = newName;
        }

        await wizard.execute();
        const site: WebSiteManagementModels.Site = nonNullProp(wizardContext, 'site');
        return new ProductionSlotTreeItem(this, new SiteClient(site, this.root), site);
    }

    public isAncestorOfImpl(contextValue: string | RegExp): boolean {
        return !isProjectCV(contextValue) || isRemoteProjectCV(contextValue);
    }
}

async function getDefaultFuncVersion(context: IActionContext): Promise<FuncVersion> {
    // Try to get VS Code setting for version (aka if they have a project open)
    let version: FuncVersion | undefined = tryParseFuncVersion(getWorkspaceSettingFromAnyFolder(funcVersionSetting));
    context.telemetry.properties.runtimeSource = 'VSCodeSetting';

    if (version === undefined) {
        // Try to get the version that matches their local func cli
        version = await tryGetLocalFuncVersion();
        context.telemetry.properties.runtimeSource = 'LocalFuncCli';
    }

    if (version === undefined) {
        version = latestGAVersion;
        context.telemetry.properties.runtimeSource = 'Backup';
    }

    context.telemetry.properties.projectRuntime = version;

    return version;
}
