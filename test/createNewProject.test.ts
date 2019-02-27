/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { createNewProject, DialogResponses, ext, IActionContext, Platform, ProjectLanguage, TestUserInput } from '../extension.bundle';
import { longRunningTestsEnabled, runForAllTemplateSources, testFolderPath } from './global.test';
import { getCSharpScriptValidateOptions, getCSharpValidateOptions, getJavaScriptValidateOptions, getJavaValidateOptions, getPythonValidateOptions, getScriptValidateOptions, getTypeScriptValidateOptions, validateProject } from './validateProject';

// tslint:disable-next-line:no-function-expression max-func-body-length
suite('Create New Project Tests', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(60 * 1000);

    const javaProject: string = 'JavaProject';
    test(javaProject, async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(5 * 60 * 1000);
        const projectPath: string = path.join(testFolderPath, javaProject);
        const appName: string = 'javaApp';
        await testCreateNewProject(
            projectPath,
            ProjectLanguage.Java,
            {},
            undefined,
            undefined,
            undefined,
            undefined,
            appName
        );
        await validateProject(projectPath, getJavaValidateOptions(appName));
    });

    const javaScriptProject: string = 'JavaScriptProject';
    test(javaScriptProject, async () => {
        const projectPath: string = path.join(testFolderPath, javaScriptProject);
        await testCreateNewProject(projectPath, ProjectLanguage.JavaScript);
        await validateProject(projectPath, getJavaScriptValidateOptions());
    });

    const csharpProject: string = 'CSharpProject';
    test(csharpProject, async () => {
        await runForAllTemplateSources(async (source) => {
            const projectPath: string = path.join(testFolderPath, source, csharpProject);
            await testCreateNewProject(projectPath, ProjectLanguage.CSharp);
            await validateProject(projectPath, getCSharpValidateOptions(csharpProject, 'netcoreapp2.1'));
        });
    });

    const bashProject: string = 'BashProject';
    test(bashProject, async () => {
        const projectPath: string = path.join(testFolderPath, bashProject);
        await testCreateNewProject(projectPath, ProjectLanguage.Bash, { hiddenLanguage: true });
        await validateProject(projectPath, getScriptValidateOptions(ProjectLanguage.Bash));
    });

    const batchProject: string = 'BatchProject';
    test(batchProject, async () => {
        const projectPath: string = path.join(testFolderPath, batchProject);
        await testCreateNewProject(projectPath, ProjectLanguage.Batch, { hiddenLanguage: true });
        await validateProject(projectPath, getScriptValidateOptions(ProjectLanguage.Batch));
    });

    const csharpScriptProject: string = 'CSharpScriptProject';
    test(csharpScriptProject, async () => {
        const projectPath: string = path.join(testFolderPath, csharpScriptProject);
        await testCreateNewProject(projectPath, ProjectLanguage.CSharpScript, { hiddenLanguage: true });
        await validateProject(projectPath, getCSharpScriptValidateOptions());
    });

    const fsharpScriptProject: string = 'FSharpScriptProject';
    test(fsharpScriptProject, async () => {
        const projectPath: string = path.join(testFolderPath, fsharpScriptProject);
        await testCreateNewProject(projectPath, ProjectLanguage.FSharpScript, { hiddenLanguage: true });
        await validateProject(projectPath, getScriptValidateOptions(ProjectLanguage.FSharpScript));
    });

    const phpProject: string = 'PHPProject';
    test(phpProject, async () => {
        const projectPath: string = path.join(testFolderPath, phpProject);
        await testCreateNewProject(projectPath, ProjectLanguage.PHP, { hiddenLanguage: true });
        await validateProject(projectPath, getScriptValidateOptions(ProjectLanguage.PHP));
    });

    const powerShellProject: string = 'PowerShellProject';
    test(powerShellProject, async () => {
        const projectPath: string = path.join(testFolderPath, powerShellProject);
        await testCreateNewProject(projectPath, ProjectLanguage.PowerShell, { hiddenLanguage: true });
        await validateProject(projectPath, getScriptValidateOptions(ProjectLanguage.PowerShell));
    });

    const pythonProject: string = 'PythonProject';
    test(pythonProject, async function (this: IHookCallbackContext): Promise<void> {
        // Temporarily disable this test on Linux due to inconsistent failures
        // https://github.com/Microsoft/vscode-azurefunctions/issues/910
        if (!longRunningTestsEnabled || os.platform() === Platform.Linux) {
            this.skip();
        }
        this.timeout(5 * 60 * 1000);

        const projectPath: string = path.join(testFolderPath, pythonProject);
        await testCreateNewProject(projectPath, ProjectLanguage.Python);
        await validateProject(projectPath, getPythonValidateOptions(pythonProject));
    });

    const typeScriptProject: string = 'TypeScriptProject';
    test(typeScriptProject, async () => {
        const projectPath: string = path.join(testFolderPath, typeScriptProject);
        await testCreateNewProject(projectPath, ProjectLanguage.TypeScript);
        await validateProject(projectPath, getTypeScriptValidateOptions());
    });

    // https://github.com/Microsoft/vscode-azurefunctions/blob/master/docs/api.md#create-new-project
    test('createNewProject API', async () => {
        const projectPath: string = path.join(testFolderPath, 'createNewProjectApi');
        await vscode.commands.executeCommand('azureFunctions.createNewProject', projectPath, 'JavaScript', '~2', false /* openFolder */);
        await validateProject(projectPath, getJavaScriptValidateOptions());
    });

    // https://github.com/Microsoft/vscode-azurefunctions/blob/master/docs/api.md#create-new-project
    test('createNewProject API C#', async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(5 * 60 * 1000);
        // Intentionally testing IoTHub trigger since a partner team plans to use that
        const templateId: string = 'Azure.Function.CSharp.IotHubTrigger.2.x';
        const functionName: string = 'createFunctionApi';
        const namespace: string = 'Company.Function';
        const iotPath: string = 'messages/events';
        const connection: string = 'IoTHub_Setting';
        const projectPath: string = path.join(testFolderPath, 'createNewProjectApiCSharp');
        ext.ui = new TestUserInput([DialogResponses.skipForNow.title]);
        await vscode.commands.executeCommand('azureFunctions.createNewProject', projectPath, 'C#', '~2', false /* openFolder */, templateId, functionName, { namespace: namespace, Path: iotPath, Connection: connection });
        await validateProject(projectPath, getCSharpValidateOptions('createNewProjectApiCSharp', 'netcoreapp2.1'));
    });

    async function testCreateNewProject(projectPath: string, language: string, options?: { hiddenLanguage?: boolean }, ...inputs: (string | undefined)[]): Promise<void> {
        const hiddenLanguage: boolean = !!options && !!options.hiddenLanguage;
        if (!hiddenLanguage) {
            inputs.unshift(language);
        }

        inputs.unshift(projectPath); // Select the test func app folder
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            inputs.unshift('$(file-directory) Browse...'); // If the test environment has an open workspace, select the 'Browse...' option
        }

        ext.ui = new TestUserInput(inputs);
        await createNewProject(<IActionContext>{ properties: {}, measurements: {} }, undefined, hiddenLanguage ? language : undefined, undefined, false);
        assert.equal(inputs.length, 0, `Not all inputs were used: ${inputs}`);
    }
});
