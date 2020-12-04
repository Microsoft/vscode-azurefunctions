/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient, StorageManagementModels } from '@azure/arm-storage';
import { isArray } from 'util';
import { IActionContext, IAzureQuickPickItem, IStorageAccountWizardContext } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { createStorageClient } from './azureClients';
import { nonNullProp, nonNullValue } from './nonNull';

function parseResourceId(id: string, caseSensitiveCheck: boolean): RegExpMatchArray {
    let matches: RegExpMatchArray | null;

    if (caseSensitiveCheck) {
        matches = id.match(/\/subscriptions\/(.*)\/resourceGroups\/(.*)\/providers\/(.*)\/(.*)/);
    } else {
        matches = id.toLowerCase().match(/\/subscriptions\/(.*)\/resourcegroups\/(.*)\/providers\/(.*)\/(.*)/);
    }

    if (matches === null || matches.length < 3) {
        throw new Error(localize('InvalidResourceId', 'Invalid Azure Resource Id'));
    }

    return matches;
}

export function getResourceGroupFromId(id: string, caseSensitiveCheck: boolean = true): string {
    return parseResourceId(id, caseSensitiveCheck)[2];
}

export function getSubscriptionFromId(id: string, caseSensitiveCheck: boolean = true): string {
    return parseResourceId(id, caseSensitiveCheck)[1];
}

export function getNameFromId(id: string, caseSensitiveCheck: boolean = true): string {
    return parseResourceId(id, caseSensitiveCheck)[4];
}

export interface IBaseResourceWithName {
    name?: string;
    _description?: string;
}

export async function promptForResource<T extends IBaseResourceWithName>(context: IActionContext, placeHolder: string, resourcesTask: Promise<T[]>): Promise<T | undefined> {
    const picksTask: Promise<IAzureQuickPickItem<T | undefined>[]> = resourcesTask.then((resources: T[]) => {
        const picks: IAzureQuickPickItem<T | undefined>[] = !isArray(resources) ? [] : <IAzureQuickPickItem<T>[]>(resources
            .map((r: T) => r.name ? { data: r, label: r.name, description: r._description } : undefined)
            .filter((p: IAzureQuickPickItem<T> | undefined) => p));
        picks.push({
            label: localize('skipForNow', '$(clock) Skip for now'),
            data: undefined,
            suppressPersistence: true
        });
        return picks;
    });

    return (await context.ui.showQuickPick(picksTask, { placeHolder })).data;
}

export interface IResourceResult {
    name: string;
    connectionString: string;
}

export async function getStorageConnectionString(context: IStorageAccountWizardContext): Promise<IResourceResult> {
    const client: StorageManagementClient = await createStorageClient(context);
    const storageAccount: StorageManagementModels.StorageAccount = nonNullProp(context, 'storageAccount');
    const name: string = nonNullProp(storageAccount, 'name');

    const resourceGroup: string = getResourceGroupFromId(nonNullProp(storageAccount, 'id'));
    const result: StorageManagementModels.StorageAccountListKeysResult = await client.storageAccounts.listKeys(resourceGroup, name);
    const key: string = nonNullProp(nonNullValue(nonNullProp(result, 'keys')[0], 'keys[0]'), 'value');

    let endpointSuffix: string = nonNullProp(context.environment, 'storageEndpointSuffix');
    // https://github.com/Azure/azure-sdk-for-node/issues/4706
    if (endpointSuffix.startsWith('.')) {
        endpointSuffix = endpointSuffix.substr(1);
    }

    return {
        name,
        connectionString: `DefaultEndpointsProtocol=https;AccountName=${name};AccountKey=${key};EndpointSuffix=${endpointSuffix}`
    };
}
