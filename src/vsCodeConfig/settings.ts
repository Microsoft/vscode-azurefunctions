/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, Uri, workspace, WorkspaceConfiguration } from "vscode";
import { IAzureQuickPickItem, IAzureQuickPickOptions } from 'vscode-azureextensionui';
import { extensionPrefix, ProjectLanguage, ProjectRuntime } from '../constants';
import { ext } from '../extensionVariables';
import { localize } from "../localize";
import { openUrl } from '../utils/openUrl';

/**
 * Uses extensionPrefix 'azureFunctions' unless otherwise specified
 */
export async function updateGlobalSetting<T = string>(section: string, value: T, prefix: string = extensionPrefix): Promise<void> {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix);
    await projectConfiguration.update(section, value, ConfigurationTarget.Global);
}

/**
 * Uses extensionPrefix 'azureFunctions' unless otherwise specified
 */
export async function updateWorkspaceSetting<T = string>(section: string, value: T, fsPath: string, prefix: string = extensionPrefix): Promise<void> {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix, Uri.file(fsPath));
    await projectConfiguration.update(section, value);
}

/**
 * Uses extensionPrefix 'azureFunctions' unless otherwise specified
 */
export function getGlobalSetting<T>(key: string, prefix: string = extensionPrefix): T | undefined {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix);
    const result: { globalValue?: T } | undefined = projectConfiguration.inspect<T>(key);
    return result && result.globalValue;
}

/**
 * Uses extensionPrefix 'azureFunctions' unless otherwise specified
 */
export function getWorkspaceSetting<T>(key: string, fsPath?: string, prefix: string = extensionPrefix): T | undefined {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix, fsPath ? Uri.file(fsPath) : undefined);
    return projectConfiguration.get<T>(key);
}

/**
 * Searches through all open folders and gets the current workspace setting (as long as there are no conflicts)
 * Uses extensionPrefix 'azureFunctions' unless otherwise specified
 */
export function getWorkspaceSettingFromAnyFolder(key: string, prefix: string = extensionPrefix): string | undefined {
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        let result: string | undefined;
        for (const folder of workspace.workspaceFolders) {
            const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix, folder.uri);
            const folderResult: string | undefined = projectConfiguration.get<string>(key);
            if (!result) {
                result = folderResult;
            } else if (folderResult && result !== folderResult) {
                return undefined;
            }
        }
        return result;
    } else {
        return getGlobalSetting(key, prefix);
    }
}

export async function promptForProjectRuntime(message?: string): Promise<ProjectRuntime> {
    const picks: IAzureQuickPickItem<ProjectRuntime | undefined>[] = [
        { label: 'Azure Functions v2', description: '(.NET Standard)', data: ProjectRuntime.v2 },
        { label: 'Azure Functions v1', description: '(.NET Framework)', data: ProjectRuntime.v1 },
        { label: localize('learnMore', 'Learn more...'), description: '', data: undefined }
    ];

    const options: IAzureQuickPickOptions = { placeHolder: message || localize('selectRuntime', 'Select a runtime'), suppressPersistence: true };
    let runtime: ProjectRuntime | undefined;
    do {
        runtime = (await ext.ui.showQuickPick(picks, options)).data;
        if (runtime === undefined) {
            await openUrl('https://aka.ms/AA1tpij');
        }
    }
    while (runtime === undefined);
    return runtime;
}

/**
 * Special notes due to recent GA of v2 (~Sept 2018):
 * We have to support 'beta' as 'v2' since it's so commonly used. We should remove this support eventually since 'beta' will probably change meaning if there's ever a v3.
 * We no longer support 'latest'. That value is not recommended, not commonly used, and is changing meaning from v1 to v2. Better to just act like we don't recognize it.
 * https://github.com/Microsoft/vscode-azurefunctions/issues/562
 */
export function convertStringToRuntime(rawRuntime: string | undefined): ProjectRuntime | undefined {
    rawRuntime = rawRuntime ? rawRuntime.toLowerCase() : '';
    if (/^~?1.*/.test(rawRuntime)) {
        return ProjectRuntime.v1;
    } else if (/^~?2.*/.test(rawRuntime) || rawRuntime === 'beta') {
        return ProjectRuntime.v2;
    } else {
        // Return undefined if we don't recognize the runtime
        return undefined;
    }
}

export function getFunctionsWorkerRuntime(language: string | undefined): string | undefined {
    switch (language) {
        case ProjectLanguage.JavaScript:
        case ProjectLanguage.TypeScript:
            return 'node';
        case ProjectLanguage.CSharp:
        case ProjectLanguage.FSharp:
            return 'dotnet';
        case ProjectLanguage.Java:
            return 'java';
        case ProjectLanguage.Python:
            return 'python';
        case ProjectLanguage.PowerShell:
            return 'powershell';
        default:
            return undefined;
    }
}
