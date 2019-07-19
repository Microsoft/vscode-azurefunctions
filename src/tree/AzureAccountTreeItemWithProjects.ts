/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Disposable, workspace, WorkspaceFolder } from 'vscode';
import { AzExtTreeItem, AzureAccountTreeItemBase, GenericTreeItem, IActionContext, ISubscriptionContext, TestAzureAccount } from 'vscode-azureextensionui';
import { tryGetFunctionProjectRoot } from '../commands/createNewProject/verifyIsProject';
import { hostFileName } from '../constants';
import { localize } from '../localize';
import { treeUtils } from '../utils/treeUtils';
import { getWorkspaceSetting } from '../vsCodeConfig/settings';
import { createRefreshFileWatcher } from './localProject/createRefreshFileWatcher';
import { LocalProjectTreeItem } from './localProject/LocalProjectTreeItem';
import { isLocalTreeItem } from './localProject/LocalTreeItem';
import { SubscriptionTreeItem } from './SubscriptionTreeItem';

const enableProjectTreeSetting: string = 'enableProjectTree';

export class AzureAccountTreeItemWithProjects extends AzureAccountTreeItemBase {
    private _projectDisposables: Disposable[] = [];

    public constructor(testAccount?: TestAzureAccount) {
        super(undefined, testAccount);
        if (getWorkspaceSetting<boolean>(enableProjectTreeSetting)) {
            this.disposables.push(workspace.onDidChangeWorkspaceFolders(async () => await this.refresh()));
        }
    }

    public dispose(): void {
        super.dispose();
        Disposable.from(...this._projectDisposables).dispose();
    }

    public createSubscriptionTreeItem(root: ISubscriptionContext): SubscriptionTreeItem {
        return new SubscriptionTreeItem(this, root);
    }

    public async loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const children: AzExtTreeItem[] = await super.loadMoreChildrenImpl(clearCache, context);

        let hasLocalProject: boolean = false;
        if (getWorkspaceSetting<boolean>(enableProjectTreeSetting)) {
            Disposable.from(...this._projectDisposables).dispose();
            this._projectDisposables = [];

            // tslint:disable-next-line: strict-boolean-expressions
            const folders: WorkspaceFolder[] = workspace.workspaceFolders || [];
            for (const folder of folders) {
                const projectPath: string | undefined = await tryGetFunctionProjectRoot(folder.uri.fsPath, true /* suppressPrompt */);
                if (projectPath) {
                    hasLocalProject = true;
                    const treeItem: LocalProjectTreeItem = new LocalProjectTreeItem(this, projectPath, folder.uri.fsPath, folder);
                    this._projectDisposables.push(treeItem);
                    children.push(treeItem);
                }

                this._projectDisposables.push(createRefreshFileWatcher(this, path.join(folder.uri.fsPath, hostFileName)));
                this._projectDisposables.push(createRefreshFileWatcher(this, path.join(folder.uri.fsPath, '*', hostFileName)));
            }
        }

        if (!hasLocalProject && children.length > 0 && children[0] instanceof GenericTreeItem) {
            const ti: GenericTreeItem = new GenericTreeItem(this, {
                label: localize('createNewProject', 'Create New Project...'),
                commandId: 'azureFunctions.createNewProject',
                contextValue: 'createNewProject',
                iconPath: treeUtils.getThemedIconPath('CreateNewProject')
            });
            ti.commandArgs = [];
            children.unshift(ti);
        }

        return children;
    }

    public compareChildrenImpl(item1: AzExtTreeItem, item2: AzExtTreeItem): number {
        if (item1 instanceof LocalProjectTreeItem && !(item2 instanceof LocalProjectTreeItem)) {
            return 1;
        } else if (!(item1 instanceof LocalProjectTreeItem) && item2 instanceof LocalProjectTreeItem) {
            return -1;
        } else {
            return super.compareChildrenImpl(item1, item2);
        }
    }

    public async pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): Promise<AzExtTreeItem | undefined> {
        if (expectedContextValues.some(isLocalTreeItem)) {
            this.childTypeLabel = localize('project', 'project');
        } else {
            this.childTypeLabel = localize('subscription', 'subscription');
            return super.pickTreeItemImpl(expectedContextValues);
        }

        return undefined;
    }
}
