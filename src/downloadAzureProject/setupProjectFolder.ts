/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { RequestPrepareOptions } from '@azure/ms-rest-js';
import * as extract from 'extract-zip';
import * as querystring from 'querystring';
import * as vscode from 'vscode';
import { IActionContext, parseError } from 'vscode-azureextensionui';
import { initProjectForVSCode } from '../commands/initProjectForVSCode/initProjectForVSCode';
import { ProjectLanguage } from '../constants';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SlotTreeItemBase } from "../tree/SlotTreeItemBase";
import { getNameFromId } from '../utils/azure';
import { requestUtils } from '../utils/requestUtils';
import { getRequiredQueryParameter, HandleUriActions } from './handleUri';

export async function setupProjectFolder(uri: vscode.Uri, vsCodeFilePathUri: vscode.Uri, context: IActionContext): Promise<void> {
    const parsedQuery: querystring.ParsedUrlQuery = querystring.parse(uri.query);
    const resourceId: string = getRequiredQueryParameter(parsedQuery, 'resourceId');
    const devContainerName: string = getRequiredQueryParameter(parsedQuery, 'devcontainer');
    const language: string = getRequiredQueryParameter(parsedQuery, 'language');
    const action: string = getRequiredQueryParameter(parsedQuery, 'action');
    const downloadAppContent: boolean = action === HandleUriActions.downloadContentAndSetupProject;

    const toBeDeletedFolderPathUri: vscode.Uri = vscode.Uri.joinPath(vsCodeFilePathUri, 'temp');

    try {
        const functionAppName: string = getNameFromId(resourceId);
        const downloadFilePath: string = vscode.Uri.joinPath(toBeDeletedFolderPathUri, `${functionAppName}.zip`).fsPath;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: localize('settingUpFunctionAppLocalProjInfoMessage', `Setting up project for function app '${functionAppName}' with language '${language}'.`) }, async () => {
            if (downloadAppContent) {
                // NOTE: We don't want to download app content for compiled languages.
                const slotTreeItem: SlotTreeItemBase | undefined = await ext.tree.findTreeItem(resourceId, { ...context, loadAll: true });
                const hostKeys: WebSiteManagementModels.HostKeys | undefined = await slotTreeItem?.client.listHostKeys();
                const defaultHostName: string | undefined = slotTreeItem?.client.defaultHostName;

                if (!!hostKeys && hostKeys.masterKey && defaultHostName) {
                    const requestOptions: RequestPrepareOptions = {
                        method: 'GET',
                        url: `https://${defaultHostName}/admin/functions/download?includeCsproj=true&includeAppSettings=true`,
                        headers: { 'x-functions-key':  hostKeys.masterKey }
                    };
                    await requestUtils.downloadFile(requestOptions, downloadFilePath);
                } else {
                    throw new Error(localize('hostInformationNotFound', 'Failed to get host information for the functionApp.'));
                }
            }

            const projectFilePathUri: vscode.Uri = vscode.Uri.joinPath(vsCodeFilePathUri, `${functionAppName}`);
            const projectFilePath: string = projectFilePathUri.fsPath;
            const devContainerFolderPathUri: vscode.Uri = vscode.Uri.joinPath(projectFilePathUri, '.devcontainer');
            if (downloadAppContent) {
                // tslint:disable-next-line: no-unsafe-any
                await extract(downloadFilePath, { dir: projectFilePath });
            }
            await requestUtils.downloadFile(
                `https://raw.githubusercontent.com/microsoft/vscode-dev-containers/master/containers/${devContainerName}/.devcontainer/devcontainer.json`,
                vscode.Uri.joinPath(devContainerFolderPathUri, 'devcontainer.json').fsPath
            );
            await requestUtils.downloadFile(
                `https://raw.githubusercontent.com/microsoft/vscode-dev-containers/master/containers/${devContainerName}/.devcontainer/Dockerfile`,
                vscode.Uri.joinPath(devContainerFolderPathUri, 'Dockerfile').fsPath
            );
            await initProjectForVSCode(context, projectFilePath, getProjectLanguageForLanguage(language));
            vscode.window.showInformationMessage(localize('restartingVsCodeInfoMessage', 'Restarting VS Code with your function app project'));
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectFilePath), true);
        });
    } catch (err) {
        throw new Error(localize('failedLocalProjSetupErrorMessage', 'Failed to set up your local project: "{0}". Please try again.', parseError(err).message));
    } finally {
        vscode.workspace.fs.delete(
            vscode.Uri.file(toBeDeletedFolderPathUri.fsPath),
            {
                recursive: true,
                useTrash: true
            }
        );
    }
}

function getProjectLanguageForLanguage(language: string): ProjectLanguage {
    switch (language) {
        case 'powershell':
            return ProjectLanguage.PowerShell;
        case 'node':
            return ProjectLanguage.TypeScript;
        case 'python':
            return ProjectLanguage.Python;
        case 'java8':
        case 'java11':
            return ProjectLanguage.Java;
        case 'dotnetcore2.1':
        case 'dotnetcore3.1':
            return ProjectLanguage.CSharp;
        default:
            throw new Error(`Language not supported: ${language}`);
    }
}
