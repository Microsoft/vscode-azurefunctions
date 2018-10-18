/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { WebSiteManagementClient } from 'azure-arm-website';
import { Site } from 'azure-arm-website/lib/models';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { AzureTreeDataProvider, DialogResponses, TestAzureAccount, TestUserInput } from 'vscode-azureextensionui';
import { ext } from '../src/extensionVariables';
import { FunctionAppProvider } from '../src/tree/FunctionAppProvider';
import * as fsUtil from '../src/utils/fs';
import { longRunningTestsEnabled } from './global.test';

suite('Create Azure Resources', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount();

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(120 * 1000);
        await testAccount.signIn();
        ext.tree = new AzureTreeDataProvider(FunctionAppProvider, 'azureFunctions.startTesting', undefined, testAccount);
    });

    suiteTeardown(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(1200 * 1000);
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

    test('Create and Delete New Function App', async () => {
        const resourceName: string = fsUtil.getRandomHexString().toLowerCase(); // storage accounts cannot contain upper case chars
        resourceGroupsToDelete.push(resourceName);

        const testInputs: string[] = [resourceName, '$(plus) Create new resource group', resourceName, '$(plus) Create new storage account', resourceName, 'West US'];
        ext.ui = new TestUserInput(testInputs);
        await vscode.commands.executeCommand('azureFunctions.createFunctionApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp: Site = await client.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);

        ext.ui = new TestUserInput([resourceName, DialogResponses.deleteResponse.title, DialogResponses.yes.title]);
        await vscode.commands.executeCommand('azureFunctions.deleteFunctionApp');
        const deletedApp: Site | undefined = await client.webApps.get(resourceName, resourceName);
        assert.ifError(deletedApp); // if app was deleted, get() returns null.  assert.ifError throws if the value passed is not null/undefined
    });

    // https://github.com/Microsoft/vscode-azurefunctions/blob/master/docs/api.md#create-function-app
    test('createFunctionApp API', async () => {
        const resourceGroupName: string = fsUtil.getRandomHexString();
        const storageAccountName: string = fsUtil.getRandomHexString().toLowerCase(); // storage accounts cannot contain upper case chars
        resourceGroupsToDelete.push(resourceGroupName);
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);

        const functionAppName1: string = fsUtil.getRandomHexString();
        const testInputs1: string[] = [functionAppName1, '$(plus) Create new storage account', storageAccountName, 'West US'];
        ext.ui = new TestUserInput(testInputs1);
        const apiResult1: string = <string>await vscode.commands.executeCommand('azureFunctions.createFunctionApp', testAccount.getSubscriptionId(), resourceGroupName);
        const createdApp1: Site = await client.webApps.get(resourceGroupName, functionAppName1);
        assert.ok(createdApp1, 'Function app with new rg/sa failed.');
        assert.equal(apiResult1, createdApp1.id, 'Function app with new rg/sa failed.');

        // Create another function app, but use the existing resource group and storage account
        const functionAppName2: string = fsUtil.getRandomHexString();
        const testInputs2: string[] = [functionAppName2, storageAccountName];
        ext.ui = new TestUserInput(testInputs2);
        const apiResult2: string = <string>await vscode.commands.executeCommand('azureFunctions.createFunctionApp', testAccount.getSubscriptionId(), resourceGroupName);
        const createdApp2: Site = await client.webApps.get(resourceGroupName, functionAppName2);
        assert.ok(createdApp2, 'Function app with existing rg/sa failed.');
        assert.equal(apiResult2, createdApp2.id, 'Function app with existing rg/sa failed.');

        // NOTE: We currently don't support 'delete' in our API, so no need to test that
    });
});

function getWebsiteManagementClient(testAccount: TestAzureAccount): WebSiteManagementClient {
    return new WebSiteManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

function getResourceManagementClient(testAccount: TestAzureAccount): ResourceManagementClient {
    return new ResourceManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}
