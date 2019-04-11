/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CosmosDBManagementClient, CosmosDBManagementModels } from 'azure-arm-cosmosdb';
import { createAzureClient } from 'vscode-azureextensionui';
import { getResourceGroupFromId } from '../../../../utils/azure';
import { nonNullProp } from '../../../../utils/nonNull';
import { IBindingWizardContext } from '../../IBindingWizardContext';
import { AzureConnectionCreateStepBase, IConnection } from '../AzureConnectionCreateStepBase';
import { ICosmosDBWizardContext } from './ICosmosDBWizardContext';

export class CosmosDBConnectionCreateStep extends AzureConnectionCreateStepBase<IBindingWizardContext & ICosmosDBWizardContext> {
    public async getConnection(wizardContext: ICosmosDBWizardContext): Promise<IConnection> {
        const databaseAccount: CosmosDBManagementModels.DatabaseAccount = nonNullProp(wizardContext, 'databaseAccount');
        const name: string = nonNullProp(databaseAccount, 'name');

        const client: CosmosDBManagementClient = createAzureClient(wizardContext, CosmosDBManagementClient);
        const resourceGroup: string = getResourceGroupFromId(nonNullProp(databaseAccount, 'id'));
        // NOTE: We have to generate the connection string ourselves rather than calling client.databaseAccounts.listConnectionStrings
        // (The runtime currently only handles Cosmos DB connection strings _not_ mongo connection strings)
        const keys: CosmosDBManagementModels.DatabaseAccountListKeysResult = await client.databaseAccounts.listKeys(resourceGroup, name);
        return {
            name: name,
            connectionString: `AccountEndpoint=${nonNullProp(databaseAccount, 'documentEndpoint')};AccountKey=${nonNullProp(keys, 'primaryMasterKey')};`
        };
    }

    public shouldExecute(wizardContext: ICosmosDBWizardContext): boolean {
        return !!wizardContext.databaseAccount;
    }
}
