/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { IHookCallbackContext } from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import { DialogResponses, TestUserInput } from 'vscode-azureextensionui';
import { ProjectLanguage, ProjectRuntime } from '../../src/constants';
import { ext } from '../../src/extensionVariables';
import { runForAllTemplateSources } from '../global.test';
import { validateVSCodeProjectFiles } from '../initProjectForVSCode.test';
import { FunctionTesterBase } from './FunctionTesterBase';

class CSharpScriptFunctionTester extends FunctionTesterBase {
    protected _language: ProjectLanguage = ProjectLanguage.CSharpScript;
    protected _runtime: ProjectRuntime = ProjectRuntime.v1;

    public async validateFunction(testFolder: string, funcName: string): Promise<void> {
        const functionPath: string = path.join(testFolder, funcName);
        assert.equal(await fse.pathExists(path.join(functionPath, 'run.csx')), true, 'run.csx does not exist');
        assert.equal(await fse.pathExists(path.join(functionPath, 'function.json')), true, 'function.json does not exist');
    }
}

suite('Create C# Script Function Tests', async () => {
    const tester: CSharpScriptFunctionTester = new CSharpScriptFunctionTester();

    suiteSetup(async () => {
        await tester.initAsync();
    });

    // tslint:disable-next-line:no-function-expression
    suiteTeardown(async function (this: IHookCallbackContext): Promise<void> {
        this.timeout(15 * 1000);
        await tester.dispose();
    });

    const httpTrigger: string = 'HTTP trigger';
    test(httpTrigger, async () => {
        await tester.testCreateFunction(
            httpTrigger,
            undefined // Use default Authorization level
        );
    });

    // Intentionally testing IoTHub trigger since a partner team plans to use that
    const iotTemplateId: string = 'IoTHubTrigger-CSharp';
    const iotFunctionName: string = 'createFunctionApi';
    const iotFunctionSettings: {} = { connection: 'test_EVENTHUB', path: 'sample-workitems', consumerGroup: '$Default' };

    // https://github.com/Microsoft/vscode-azurefunctions/blob/master/docs/api.md#create-local-function
    test('createFunction API', async () => {
        await runForAllTemplateSources(async (source) => {
            // Intentionally testing IoTHub trigger since a partner team plans to use that
            const projectPath: string = path.join(tester.baseTestFolder, source);
            await vscode.commands.executeCommand('azureFunctions.createFunction', projectPath, iotTemplateId, iotFunctionName, iotFunctionSettings);
            await tester.validateFunction(projectPath, iotFunctionName);
        });
    });

    test('createNewProjectAndFunction API', async () => {
        await runForAllTemplateSources(async (source) => {
            const projectPath: string = path.join(tester.baseTestFolder, source, 'createNewProjectAndFunction');
            ext.ui = new TestUserInput([DialogResponses.skipForNow.title]);
            await vscode.commands.executeCommand('azureFunctions.createNewProject', projectPath, 'C#Script', '~1', false /* openFolder */, iotTemplateId, iotFunctionName, iotFunctionSettings);
            await tester.validateFunction(projectPath, iotFunctionName);
            await validateVSCodeProjectFiles(projectPath);
        });
    });
});
