/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { DebugConfiguration, TaskDefinition } from 'vscode';
import { AzureWizardExecuteStep } from 'vscode-azureextensionui';
import { deploySubpathSetting, extensionPrefix, gitignoreFileName, launchFileName, preDeployTaskSetting, ProjectLanguage, projectLanguageSetting, ProjectRuntime, projectRuntimeSetting, settingsFileName, tasksFileName } from '../../../constants';
import { confirmEditJsonFile, confirmOverwriteFile, isPathEqual, writeFormattedJson } from '../../../utils/fs';
import { nonNullProp } from '../../../utils/nonNull';
import { getContainingWorkspace } from '../../../utils/workspace';
import { updateWorkspaceSetting } from '../../../vsCodeConfig/settings';
import { IFunctionWizardContext } from '../../createFunction/IFunctionWizardContext';
import { IProjectWizardContext } from '../../createNewProject/IProjectWizardContext';

export abstract class InitVSCodeStepBase extends AzureWizardExecuteStep<IProjectWizardContext> {
    public priority: number = 20;

    protected preDeployTask?: string;
    protected settings: ISettingToAdd[] = [];

    public async execute(wizardContext: IProjectWizardContext): Promise<void> {
        await this.executeCore(wizardContext);

        const runtime: ProjectRuntime = nonNullProp(wizardContext, 'runtime');
        wizardContext.actionContext.properties.projectRuntime = runtime;

        const language: ProjectLanguage = nonNullProp(wizardContext, 'language');
        wizardContext.actionContext.properties.projectLanguage = language;

        const vscodePath: string = path.join(wizardContext.workspacePath, '.vscode');
        await fse.ensureDir(vscodePath);
        await this.writeTasksJson(wizardContext, vscodePath, runtime);
        await this.writeLaunchJson(vscodePath, runtime);
        await this.writeSettingsJson(wizardContext, vscodePath, language, runtime);
        await this.writeExtensionsJson(vscodePath, language);

        // Remove '.vscode' from gitignore if applicable
        const gitignorePath: string = path.join(wizardContext.workspacePath, gitignoreFileName);
        if (await fse.pathExists(gitignorePath)) {
            let gitignoreContents: string = (await fse.readFile(gitignorePath)).toString();
            gitignoreContents = gitignoreContents.replace(/^\.vscode\s*$/gm, '');
            await fse.writeFile(gitignorePath, gitignoreContents);
        }
    }

    public shouldExecute(_wizardContext: IProjectWizardContext): boolean {
        return true;
    }

    protected abstract executeCore(wizardContext: IProjectWizardContext): Promise<void>;
    protected abstract getTasks(runtime: ProjectRuntime): TaskDefinition[];
    protected getDebugConfiguration?(runtime: ProjectRuntime): DebugConfiguration;
    protected getRecommendedExtensions?(language: ProjectLanguage): string[];

    protected setDeploySubpath(wizardContext: IProjectWizardContext, deploySubpath: string): string {
        deploySubpath = this.addSubDir(wizardContext, deploySubpath);
        this.settings.push({ key: deploySubpathSetting, value: deploySubpath });
        return deploySubpath;
    }

    protected addSubDir(wizardContext: IProjectWizardContext, fsPath: string): string {
        const subDir: string = path.relative(wizardContext.workspacePath, wizardContext.projectPath);
        // always use posix for debug config
        return path.posix.join(subDir, fsPath);
    }

    private async writeTasksJson(wizardContext: IFunctionWizardContext, vscodePath: string, runtime: ProjectRuntime): Promise<void> {
        const tasksJsonPath: string = path.join(vscodePath, tasksFileName);
        if (await confirmOverwriteFile(tasksJsonPath)) {
            const tasks: TaskDefinition[] = this.getTasks(runtime);
            for (const task of tasks) {
                // tslint:disable-next-line: strict-boolean-expressions no-unsafe-any
                let cwd: string = (task.options && task.options.cwd) || '.';
                cwd = this.addSubDir(wizardContext, cwd);
                if (!isPathEqual(cwd, '.')) {
                    // tslint:disable-next-line: strict-boolean-expressions
                    task.options = task.options || {};
                    // always use posix for debug config
                    // tslint:disable-next-line: no-unsafe-any no-invalid-template-strings
                    task.options.cwd = path.posix.join('${workspaceFolder}', cwd);
                }
            }

            await writeFormattedJson(tasksJsonPath, { version: '2.0.0', tasks });
        }
    }

    private async writeLaunchJson(vscodePath: string, runtime: ProjectRuntime): Promise<void> {
        if (this.getDebugConfiguration) {
            const launchJsonPath: string = path.join(vscodePath, launchFileName);
            if (await confirmOverwriteFile(launchJsonPath)) {
                const debugConfig: DebugConfiguration = this.getDebugConfiguration(runtime);
                await writeFormattedJson(launchJsonPath, { version: '0.2.0', configurations: [debugConfig] });
            }
        }
    }

    private async writeSettingsJson(wizardContext: IFunctionWizardContext, vscodePath: string, language: string, runtime: ProjectRuntime): Promise<void> {
        const settings: ISettingToAdd[] = this.settings.concat(
            { key: projectLanguageSetting, value: language },
            { key: projectRuntimeSetting, value: runtime },
            // We want the terminal to be open after F5, not the debug console (Since http triggers are printed in the terminal)
            { prefix: 'debug', key: 'internalConsoleOptions', value: 'neverOpen' }
        );

        if (this.preDeployTask) {
            settings.push({ key: preDeployTaskSetting, value: this.preDeployTask });
        }

        if (getContainingWorkspace(wizardContext.projectPath)) {
            for (const setting of settings) {
                await updateWorkspaceSetting(setting.key, setting.value, wizardContext.workspacePath, setting.prefix);
            }
        } else {
            const settingsJsonPath: string = path.join(vscodePath, settingsFileName);
            await confirmEditJsonFile(
                settingsJsonPath,
                (data: {}): {} => {
                    for (const setting of settings) {
                        const key: string = `${setting.prefix || extensionPrefix}.${setting.key}`;
                        data[key] = setting.value;
                    }
                    return data;
                }
            );
        }
    }

    private async writeExtensionsJson(vscodePath: string, language: ProjectLanguage): Promise<void> {
        const extensionsJsonPath: string = path.join(vscodePath, 'extensions.json');
        await confirmEditJsonFile(
            extensionsJsonPath,
            (data: IRecommendations): {} => {
                const recommendations: string[] = ['ms-azuretools.vscode-azurefunctions'];
                if (this.getRecommendedExtensions) {
                    recommendations.push(...this.getRecommendedExtensions(language));
                }

                if (data.recommendations) {
                    recommendations.push(...data.recommendations);
                }

                // de-dupe array
                data.recommendations = recommendations.filter((rec: string, index: number) => recommendations.indexOf(rec) === index);
                return data;
            }
        );
    }
}

interface IRecommendations {
    recommendations?: string[];
}

interface ISettingToAdd {
    key: string;
    value: string | {};
    prefix?: string;
}
