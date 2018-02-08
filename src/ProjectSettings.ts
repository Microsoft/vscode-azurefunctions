/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { MessageItem, WorkspaceConfiguration } from "vscode";
import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import { DialogResponses } from './DialogResponses';
import { IUserInterface, Pick } from "./IUserInterface";
import { localize } from "./localize";

export const extensionPrefix: string = 'azureFunctions';
export const projectLanguageSetting: string = 'projectLanguage';
export const projectRuntimeSetting: string = 'projectRuntime';
export const templateFilterSetting: string = 'templateFilter';
export const deploySubpathSetting: string = 'deploySubpath';

const previewDescription: string = localize('previewDescription', '(Preview)');

export enum ProjectLanguage {
    Bash = 'Bash',
    Batch = 'Batch',
    CSharp = 'C#',
    CSharpScript = 'C#Script',
    FSharpScript = 'F#Script',
    Java = 'Java',
    JavaScript = 'JavaScript',
    PHP = 'PHP',
    PowerShell = 'PowerShell',
    Python = 'Python',
    TypeScript = 'TypeScript'
}

export enum ProjectRuntime {
    one = '~1',
    beta = 'beta'
}

export enum TemplateFilter {
    All = 'All',
    Core = 'Core',
    Verified = 'Verified'
}

export async function updateGlobalSetting<T = string>(section: string, value: T): Promise<void> {
    const projectConfiguration: WorkspaceConfiguration = vscode.workspace.getConfiguration(extensionPrefix);
    await projectConfiguration.update(section, value, vscode.ConfigurationTarget.Global);
}

async function updateWorkspaceSetting<T = string>(section: string, value: T, fsPath: string): Promise<void> {
    const projectConfiguration: WorkspaceConfiguration = vscode.workspace.getConfiguration(extensionPrefix, vscode.Uri.file(fsPath));
    await projectConfiguration.update(section, value);
}

export async function selectProjectLanguage(projectPath: string, ui: IUserInterface): Promise<ProjectLanguage> {
    const picks: Pick[] = [
        new Pick(ProjectLanguage.JavaScript),
        new Pick(ProjectLanguage.CSharp),
        new Pick(ProjectLanguage.CSharpScript),
        new Pick(ProjectLanguage.FSharpScript),
        new Pick(ProjectLanguage.Bash, previewDescription),
        new Pick(ProjectLanguage.Batch, previewDescription),
        new Pick(ProjectLanguage.Java, previewDescription),
        new Pick(ProjectLanguage.PHP, previewDescription),
        new Pick(ProjectLanguage.PowerShell, previewDescription),
        new Pick(ProjectLanguage.Python, previewDescription),
        new Pick(ProjectLanguage.TypeScript, previewDescription)
    ];

    const result: string = (await ui.showQuickPick(picks, localize('selectLanguage', 'Select a language'))).label;
    await updateWorkspaceSetting(projectLanguageSetting, result, projectPath);
    return <ProjectLanguage>result;
}

export async function selectProjectRuntime(projectPath: string, ui: IUserInterface): Promise<ProjectRuntime> {
    const picks: Pick[] = [
        new Pick(ProjectRuntime.one, localize('productionUseDescription', '(Approved for production use)')),
        new Pick(ProjectRuntime.beta, previewDescription)
    ];

    const result: string = (await ui.showQuickPick(picks, localize('selectRuntime', 'Select a runtime'))).label;
    await updateWorkspaceSetting(projectRuntimeSetting, result, projectPath);
    return <ProjectRuntime>result;
}

export async function selectTemplateFilter(projectPath: string, ui: IUserInterface): Promise<TemplateFilter> {
    const picks: Pick[] = [
        new Pick(TemplateFilter.Verified, localize('verifiedDescription', '(Subset of "Core" that has been verified in VS Code)')),
        new Pick(TemplateFilter.Core),
        new Pick(TemplateFilter.All)
    ];

    const result: string = (await ui.showQuickPick(picks, localize('selectFilter', 'Select a template filter'))).label;
    await updateWorkspaceSetting(templateFilterSetting, result, projectPath);
    return <TemplateFilter>result;
}

export function getGlobalFuncExtensionSetting<T>(key: string): T | undefined {
    const projectConfiguration: WorkspaceConfiguration = vscode.workspace.getConfiguration(extensionPrefix);
    const result: { globalValue?: T } | undefined = projectConfiguration.inspect<T>(key);
    return result && result.globalValue;
}

export function getFuncExtensionSetting<T>(key: string, fsPath?: string): T | undefined {
    const projectConfiguration: WorkspaceConfiguration = vscode.workspace.getConfiguration(extensionPrefix, fsPath ? vscode.Uri.file(fsPath) : undefined);
    // tslint:disable-next-line:no-backbone-get-set-outside-model
    return projectConfiguration.get<T>(key);
}

export async function getProjectLanguage(projectPath: string, ui: IUserInterface): Promise<ProjectLanguage> {
    if (await fse.pathExists(path.join(projectPath, 'pom.xml'))) {
        return ProjectLanguage.Java;
    } else {
        let language: string | undefined = getFuncExtensionSetting(projectLanguageSetting, projectPath);
        if (!language) {
            const message: string = localize('noLanguage', 'You must have a project language set to perform this operation.');
            const selectLanguage: MessageItem = { title: localize('selectLanguageButton', 'Select Language') };
            const result: MessageItem | undefined = await vscode.window.showWarningMessage(message, selectLanguage, DialogResponses.cancel);
            if (result !== selectLanguage) {
                throw new UserCancelledError();
            } else {
                language = await selectProjectLanguage(projectPath, ui);
            }
        }

        return <ProjectLanguage>language;
    }
}

export async function getProjectRuntime(language: ProjectLanguage, projectPath: string, ui: IUserInterface): Promise<ProjectRuntime> {
    if (language === ProjectLanguage.Java) {
        // Java only supports beta
        return ProjectRuntime.beta;
    }

    let runtime: string | undefined = convertStringToRuntime(getFuncExtensionSetting(projectRuntimeSetting, projectPath));
    if (!runtime) {
        const message: string = localize('noRuntime', 'You must have a project runtime set to perform this operation.');
        const selectRuntime: MessageItem = { title: localize('selectRuntimeButton', 'Select Runtime') };
        const result: MessageItem | undefined = await vscode.window.showWarningMessage(message, selectRuntime, DialogResponses.cancel);
        if (result !== selectRuntime) {
            throw new UserCancelledError();
        } else {
            runtime = await selectProjectRuntime(projectPath, ui);
        }
    }

    return <ProjectRuntime>runtime;
}

export async function getTemplateFilter(projectPath: string): Promise<TemplateFilter> {
    const templateFilter: string | undefined = getFuncExtensionSetting(templateFilterSetting, projectPath);
    return templateFilter ? <TemplateFilter>templateFilter : TemplateFilter.Verified;
}

export function convertStringToRuntime(rawRuntime?: string): ProjectRuntime | undefined {
    switch (String(rawRuntime).toLowerCase()) {
        case 'beta':
            return ProjectRuntime.beta;
        case '~1':
        case 'latest':
            return ProjectRuntime.one;
        default:
            return undefined;
    }
}
