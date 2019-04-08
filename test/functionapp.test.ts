/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { WebSiteManagementClient, WebSiteManagementModels } from 'azure-arm-website';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { AzureTreeDataProvider, DialogResponses, ext, extensionPrefix, FunctionAppProvider, getRandomHexString, TestAzureAccount, TestUserInput } from '../extension.bundle';
import { longRunningTestsEnabled } from './global.test';

// tslint:disable-next-line:max-func-body-length
suite('Function App actions', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    let oldAdvancedCreationSetting: boolean | undefined;
    const resourceName: string = getRandomHexString().toLowerCase();
    const testAccount: TestAzureAccount = new TestAzureAccount();

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(120 * 1000);
        oldAdvancedCreationSetting = <boolean>vscode.workspace.getConfiguration(extensionPrefix).get('advancedCreation');
        await testAccount.signIn();
        ext.tree = new AzureTreeDataProvider(FunctionAppProvider, 'azureFunctions.startTesting', undefined, testAccount);
    });

    suiteTeardown(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(1200 * 1000);
        await vscode.workspace.getConfiguration(extensionPrefix).update('advancedCreation', oldAdvancedCreationSetting, vscode.ConfigurationTarget.Global);
        const client: ResourceManagementClient = getResourceManagementClient(testAccount);
        for (const resourceGroup of resourceGroupsToDelete) {
            if (await client.resourceGroups.checkExistence(resourceGroup)) {
                console.log(`Deleting resource group "${resourceGroup}"...`);
                await client.resourceGroups.deleteMethod(resourceGroup);
                console.log(`Resource group "${resourceGroup}" deleted.`);
            } else {
                // If the test failed, the resource group might not actually exist
                console.log(`Ignoring resource group "${resourceGroup}" because it does not exist.`);
            }
        }
        ext.tree.dispose();
    });

    test('createFunctionApp (basic)', async () => {
        const resourceName1: string = getRandomHexString().toLowerCase();
        resourceGroupsToDelete.push(resourceName1);
        const testInputs: string[] = [resourceName1, '$(plus) Create new resource group', resourceName1, '$(plus) Create new storage account', resourceName1, 'East US'];
        ext.ui = new TestUserInput(testInputs);
        await vscode.commands.executeCommand('azureFunctions.createFunctionApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp: WebSiteManagementModels.Site = await client.webApps.get(resourceName1, resourceName1);
        assert.ok(createdApp);
    });

    test('createFunctionApp (Advanced)', async () => {
        resourceGroupsToDelete.push(resourceName);
        await vscode.workspace.getConfiguration(extensionPrefix).update('advancedCreation', true, vscode.ConfigurationTarget.Global);
        const testInputs: string[] = [resourceName, 'Linux', '.NET', '$(plus) Create new resource group', resourceName, '$(plus) Create new storage account', resourceName, 'West US'];
        ext.ui = new TestUserInput(testInputs);
        await vscode.commands.executeCommand('azureFunctions.createFunctionApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp: WebSiteManagementModels.Site = await client.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
    });

    test('stopFunctionApp', async () => {
        ext.ui = new TestUserInput([resourceName]);
        await vscode.commands.executeCommand('azureFunctions.stopFunctionApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp: WebSiteManagementModels.Site = await client.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Stopped', `Function App state should be 'Stopped' rather than ${createdApp.state}.`);
    });

    test('startFunctionApp', async () => {
        ext.ui = new TestUserInput([resourceName]);
        await vscode.commands.executeCommand('azureFunctions.startFunctionApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp: WebSiteManagementModels.Site = await client.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Function App state should be 'Running' rather than ${createdApp.state}.`);
    });

    test('restartFunctionApp', async () => {
        let client: WebSiteManagementClient;
        let createdApp: WebSiteManagementModels.Site;
        ext.ui = new TestUserInput([resourceName]);
        await vscode.commands.executeCommand('azureFunctions.stopFunctionApp');
        client = getWebsiteManagementClient(testAccount);
        createdApp = await client.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Stopped', `Function App state should be 'Stopped' rather than ${createdApp.state}.`);

        ext.ui = new TestUserInput([resourceName, resourceName]);
        await vscode.commands.executeCommand('azureFunctions.restartFunctionApp');
        client = getWebsiteManagementClient(testAccount);
        createdApp = await client.webApps.get(resourceName, resourceName);
        assert.equal(createdApp.state, 'Running', `Function App state should be 'Running' rather than ${createdApp.state}.`);
    });

    test('deleteFunctionApp', async () => {
        ext.ui = new TestUserInput([resourceName, DialogResponses.deleteResponse.title, DialogResponses.yes.title]);
        await vscode.commands.executeCommand('azureFunctions.deleteFunctionApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const deletedApp: WebSiteManagementModels.Site | undefined = await client.webApps.get(resourceName, resourceName);
        assert.ifError(deletedApp);
    });
});

function getWebsiteManagementClient(testAccount: TestAzureAccount): WebSiteManagementClient {
    return new WebSiteManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

function getResourceManagementClient(testAccount: TestAzureAccount): ResourceManagementClient {
    return new ResourceManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}
