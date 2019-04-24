/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { DialogResponses, ext, ProjectLanguage, projectLanguageSetting, ProjectRuntime, projectRuntimeSetting, TestUserInput } from '../../extension.bundle';
import { runForAllTemplateSources } from '../global.test';
import { runWithFuncSetting } from '../runWithSetting';
import { getDotnetScriptValidateOptions, validateProject } from '../validateProject';
import { FunctionTesterBase } from './FunctionTesterBase';

class CSharpScriptFunctionTester extends FunctionTesterBase {
    public language: ProjectLanguage = ProjectLanguage.CSharpScript;
    public runtime: ProjectRuntime = ProjectRuntime.v1;

    public getExpectedPaths(functionName: string): string[] {
        return [
            path.join(functionName, 'function.json'),
            path.join(functionName, 'run.csx')
        ];
    }
}

suite('Create Function C# Script ~1', async () => {
    const tester: CSharpScriptFunctionTester = new CSharpScriptFunctionTester();

    suiteSetup(async () => {
        await tester.initAsync();
    });

    suiteTeardown(async () => {
        await tester.dispose();
    });

    // Intentionally testing IoTHub trigger since a partner team plans to use that
    const iotTemplateId: string = 'IoTHubTrigger-CSharp';
    const iotFunctionName: string = 'createFunctionApi';
    const iotConnection: string = 'test_EVENTHUB';
    const iotPath: string = 'test-workitems';
    const iotConsumerGroup: string = 'testconsumergroup';
    const iotTriggerSettings: {} = { connection: iotConnection, path: iotPath, consumerGroup: iotConsumerGroup };
    const iotExpectedContents: string[] = [iotConnection, iotPath, iotConsumerGroup];

    // https://github.com/Microsoft/vscode-azurefunctions/blob/master/docs/api.md#create-local-function
    test('createFunction API', async () => {
        await runForAllTemplateSources(async (source) => {
            // Intentionally testing IoTHub trigger since a partner team plans to use that
            const projectPath: string = path.join(tester.baseTestFolder, source);
            await runWithFuncSetting(projectLanguageSetting, ProjectLanguage.CSharpScript, async () => {
                await runWithFuncSetting(projectRuntimeSetting, ProjectRuntime.v1, async () => {
                    await vscode.commands.executeCommand('azureFunctions.createFunction', projectPath, iotTemplateId, iotFunctionName, iotTriggerSettings);
                });
            });
            await tester.validateFunction(projectPath, iotFunctionName, iotExpectedContents);
        });
    });

    test('createNewProjectAndFunction API', async () => {
        await runForAllTemplateSources(async (source) => {
            const projectPath: string = path.join(tester.baseTestFolder, source, 'createNewProjectAndFunction');
            ext.ui = new TestUserInput([DialogResponses.skipForNow.title]);
            await vscode.commands.executeCommand('azureFunctions.createNewProject', projectPath, 'C#Script', '~1', false /* openFolder */, iotTemplateId, iotFunctionName, iotTriggerSettings);
            await tester.validateFunction(projectPath, iotFunctionName, iotExpectedContents);
            await validateProject(projectPath, getDotnetScriptValidateOptions(ProjectLanguage.CSharpScript, ProjectRuntime.v1));
        });
    });
});
