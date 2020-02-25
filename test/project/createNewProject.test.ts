/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IHookCallbackContext } from 'mocha';
import { TestInput } from 'vscode-azureextensiondev';
import { ext, FuncVersion, ProjectLanguage, TemplateSource } from '../../extension.bundle';
import { longRunningTestsEnabled, runForAllTemplateSources } from '../global.test';
import { createAndValidateProject, ICreateProjectTestOptions } from './createAndValidateProject';
import { getCSharpValidateOptions, getDotnetScriptValidateOptions, getFSharpValidateOptions, getJavaScriptValidateOptions, getJavaValidateOptions, getPowerShellValidateOptions, getPythonValidateOptions, getTypeScriptValidateOptions } from './validateProject';

suite('Create New Project', async () => {
    const testCases: ICreateProjectTestCase[] = [
        { ...getCSharpValidateOptions('C#Project', 'netcoreapp2.1', FuncVersion.v2) },
        // Temorarily disable latest because it still references netcoreapp3.0
        { ...getCSharpValidateOptions('C#Project', 'netcoreapp3.1', FuncVersion.v3), templateSourceToSkip: TemplateSource.Latest },
        { ...getFSharpValidateOptions('F#Project', 'netcoreapp2.1', FuncVersion.v2), isHiddenLanguage: true },
        { ...getFSharpValidateOptions('F#Project', 'netcoreapp3.1', FuncVersion.v3), isHiddenLanguage: true, templateSourceToSkip: TemplateSource.Latest },
    ];

    // Test cases that are the same for both v2 and v3
    for (const version of [FuncVersion.v2, FuncVersion.v3]) {
        testCases.push(
            { ...getJavaScriptValidateOptions(true /* hasPackageJson */, version) },
            { ...getTypeScriptValidateOptions(version) },
            { ...getPowerShellValidateOptions(version) },
            { ...getDotnetScriptValidateOptions(ProjectLanguage.CSharpScript, version), isHiddenLanguage: true },
            { ...getDotnetScriptValidateOptions(ProjectLanguage.FSharpScript, version), isHiddenLanguage: true },
        );

        testCases.push({
            ...getPythonValidateOptions('.venv', version),
            timeout: 2 * 60 * 1000,
            inputs: [/3\.6/]
        });

        const appName: string = 'javaApp';
        testCases.push({
            ...getJavaValidateOptions(appName, version),
            timeout: 5 * 60 * 1000,
            inputs: [TestInput.UseDefaultValue, TestInput.UseDefaultValue, TestInput.UseDefaultValue, TestInput.UseDefaultValue, appName]
        });
    }

    for (const testCase of testCases) {
        addTest(testCase);
    }
});

interface ICreateProjectTestCase extends ICreateProjectTestOptions {
    timeout?: number;
    templateSourceToSkip?: TemplateSource;
}

function addTest(testCase: ICreateProjectTestCase): void {
    test(`${testCase.language} ${testCase.version}`, async function (this: IHookCallbackContext): Promise<void> {
        if (testCase.timeout !== undefined) {
            if (longRunningTestsEnabled) {
                this.timeout(testCase.timeout);
            } else {
                this.skip();
            }
        }

        await runForAllTemplateSources(async () => {
            if (testCase.templateSourceToSkip === ext.templateProvider.templateSource) {
                console.log(`Skipping template source "${ext.templateProvider.templateSource}"`);
                return;
            }

            await createAndValidateProject(testCase);
        });
    });
}
