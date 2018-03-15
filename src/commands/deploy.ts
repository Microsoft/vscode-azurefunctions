/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { MessageItem } from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import * as appservice from 'vscode-azureappservice';
import { AzureTreeDataProvider, IAzureNode, IAzureParentNode, IAzureUserInput, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
import * as xml2js from 'xml2js';
import { DialogResponses } from '../DialogResponses';
import { ArgumentError } from '../errors';
import { HttpAuthLevel } from '../FunctionConfig';
import { IUserInterface } from '../IUserInterface';
import { localize } from '../localize';
import { convertStringToRuntime, deploySubpathSetting, extensionPrefix, getProjectLanguage, getProjectRuntime, ProjectLanguage, ProjectRuntime } from '../ProjectSettings';
import { FunctionAppTreeItem } from '../tree/FunctionAppTreeItem';
import { FunctionsTreeItem } from '../tree/FunctionsTreeItem';
import { FunctionTreeItem } from '../tree/FunctionTreeItem';
import { cpUtils } from '../utils/cpUtils';
import { mavenUtils } from '../utils/mavenUtils';
import * as workspaceUtil from '../utils/workspace';
import { VSCodeUI } from '../VSCodeUI';

export async function deploy(telemetryProperties: TelemetryProperties, tree: AzureTreeDataProvider, outputChannel: vscode.OutputChannel, ui: IAzureUserInput, deployPath?: vscode.Uri | string, functionAppId?: string | {}, oldUi: IUserInterface = new VSCodeUI()): Promise<void> {
    let deployFsPath: string;
    if (!deployPath) {
        deployFsPath = await workspaceUtil.selectWorkspaceFolder(oldUi, localize('azFunc.selectZipDeployFolder', 'Select the folder to zip and deploy'), deploySubpathSetting);
    } else if (deployPath instanceof vscode.Uri) {
        deployFsPath = deployPath.fsPath;
    } else {
        deployFsPath = deployPath;
    }

    let node: IAzureParentNode<FunctionAppTreeItem>;
    if (!functionAppId || typeof functionAppId !== 'string') {
        node = <IAzureParentNode<FunctionAppTreeItem>>await tree.showNodePicker(FunctionAppTreeItem.contextValue);
    } else {
        const functionAppNode: IAzureNode | undefined = await tree.findNode(functionAppId);
        if (functionAppNode) {
            node = <IAzureParentNode<FunctionAppTreeItem>>functionAppNode;
        } else {
            throw new Error(localize('noMatchingFunctionApp', 'Failed to find a function app matching id "{0}".', functionAppId));
        }
    }

    const client: SiteClient = node.treeItem.client;

    const language: ProjectLanguage = await getProjectLanguage(deployFsPath, oldUi);
    telemetryProperties.projectLanguage = language;
    const runtime: ProjectRuntime = await getProjectRuntime(language, deployFsPath, oldUi);
    telemetryProperties.projectRuntime = runtime;

    if (language === ProjectLanguage.Java) {
        deployFsPath = await getJavaFolderPath(outputChannel, deployFsPath, oldUi);
    }

    await verifyRuntimeIsCompatible(runtime, outputChannel, client);

    await node.treeItem.runWithTemporaryState(
        localize('deploying', 'Deploying...'),
        node,
        async () => {
            try {
                // Stop function app here to avoid *.jar file in use on server side.
                // More details can be found: https://github.com/Microsoft/vscode-azurefunctions/issues/106
                if (language === ProjectLanguage.Java) {
                    outputChannel.appendLine(localize('stopFunctionApp', 'Stopping Function App: {0} ...', client.fullName));
                    await client.stop();
                }
                await appservice.deploy(client, deployFsPath, outputChannel, ui, extensionPrefix, true, telemetryProperties);
            } finally {
                if (language === ProjectLanguage.Java) {
                    outputChannel.appendLine(localize('startFunctionApp', 'Starting Function App: {0} ...', client.fullName));
                    await client.start();
                }
            }
        }
    );

    const children: IAzureNode[] = await node.getCachedChildren();
    const functionsNode: IAzureParentNode<FunctionsTreeItem> = <IAzureParentNode<FunctionsTreeItem>>children.find((n: IAzureNode) => n.treeItem instanceof FunctionsTreeItem);
    await node.treeDataProvider.refresh(functionsNode);
    const functions: IAzureNode<FunctionTreeItem>[] = <IAzureNode<FunctionTreeItem>[]>await functionsNode.getCachedChildren();
    const anonFunctions: IAzureNode<FunctionTreeItem>[] = functions.filter((f: IAzureNode<FunctionTreeItem>) => f.treeItem.config.isHttpTrigger && f.treeItem.config.authLevel === HttpAuthLevel.anonymous);
    if (anonFunctions.length > 0) {
        outputChannel.appendLine(localize('anonymousFunctionUrls', 'HTTP Trigger Urls:'));
        for (const func of anonFunctions) {
            outputChannel.appendLine(`  ${func.treeItem.label}: ${func.treeItem.triggerUrl}`);
        }
    }

    if (functions.find((f: IAzureNode<FunctionTreeItem>) => f.treeItem.config.isHttpTrigger && f.treeItem.config.authLevel !== HttpAuthLevel.anonymous)) {
        outputChannel.appendLine(localize('nonAnonymousWarning', 'WARNING: Some http trigger urls cannot be displayed in the output window because they require an authentication token. Instead, you may copy them from the Azure Functions explorer.'));
    }
}

async function getJavaFolderPath(outputChannel: vscode.OutputChannel, basePath: string, ui: IUserInterface): Promise<string> {
    await mavenUtils.validateMavenInstalled(basePath);
    outputChannel.show();
    await cpUtils.executeCommand(outputChannel, basePath, 'mvn', 'clean', 'package', '-B');
    const pomLocation: string = path.join(basePath, 'pom.xml');
    const functionAppName: string | undefined = await getFunctionAppNameInPom(pomLocation);
    const targetFolder: string = functionAppName ? path.join(basePath, 'target', 'azure-functions', functionAppName) : '';
    if (functionAppName && await fse.pathExists(targetFolder)) {
        return targetFolder;
    } else {
        const message: string = localize('azFunc.cannotFindPackageFolder', 'Cannot find the packaged function folder, would you like to specify the folder location?');
        const result: MessageItem | undefined = await vscode.window.showWarningMessage(message, DialogResponses.yes, DialogResponses.cancel);
        if (result === DialogResponses.yes) {
            return await ui.showFolderDialog();
        } else {
            throw new UserCancelledError();
        }
    }
}

async function verifyRuntimeIsCompatible(localRuntime: ProjectRuntime, outputChannel: vscode.OutputChannel, client: SiteClient): Promise<void> {
    const appSettings: StringDictionary = await client.listApplicationSettings();
    if (!appSettings.properties) {
        throw new ArgumentError(appSettings);
    } else {
        const rawAzureRuntime: string = appSettings.properties.FUNCTIONS_EXTENSION_VERSION;
        const azureRuntime: ProjectRuntime | undefined = convertStringToRuntime(rawAzureRuntime);
        // If we can't recognize the Azure runtime (aka it's undefined), just assume it's compatible
        if (azureRuntime !== undefined && azureRuntime !== localRuntime) {
            const message: string = localize('azFunc.notBetaRuntime', 'The remote runtime "{0}" is not compatible with your local runtime "{1}". Update remote runtime?', rawAzureRuntime, localRuntime);
            const result: MessageItem | undefined = await vscode.window.showWarningMessage(message, DialogResponses.yes, DialogResponses.cancel);
            if (result === DialogResponses.yes) {
                outputChannel.appendLine(localize('azFunc.updateFunctionRuntime', 'Updating FUNCTIONS_EXTENSION_VERSION to "{0}"...', localRuntime));
                appSettings.properties.FUNCTIONS_EXTENSION_VERSION = localRuntime;
                await client.updateApplicationSettings(appSettings);
            } else {
                throw new UserCancelledError();
            }
        }
    }
}

async function getFunctionAppNameInPom(pomLocation: string): Promise<string | undefined> {
    const pomString: string = await fse.readFile(pomLocation, 'utf-8');
    return await new Promise((resolve: (ret: string | undefined) => void): void => {
        // tslint:disable-next-line:no-any
        xml2js.parseString(pomString, { explicitArray: false }, (err: any, result: any): void => {
            if (result && !err) {
                // tslint:disable-next-line:no-string-literal no-unsafe-any
                if (result['project'] && result['project']['properties']) {
                    // tslint:disable-next-line:no-string-literal no-unsafe-any
                    resolve(result['project']['properties']['functionAppName']);
                    return;
                }
            }
            resolve(undefined);
        });
    });
}
