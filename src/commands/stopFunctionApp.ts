/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureTreeDataProvider, IAzureNode } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { FunctionAppTreeItem } from '../tree/FunctionAppTreeItem';

export async function stopFunctionApp(tree: AzureTreeDataProvider, node?: IAzureNode<FunctionAppTreeItem>): Promise<void> {
    if (!node) {
        node = <IAzureNode<FunctionAppTreeItem>>await tree.showNodePicker(FunctionAppTreeItem.contextValue);
    }

    await node.treeItem.runWithTemporaryState(
        localize('stopping', 'Stopping...'),
        node,
        async () => {
            // tslint:disable-next-line:no-non-null-assertion
            await node!.treeItem.client.stop();
        }
    );
}
