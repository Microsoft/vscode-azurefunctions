/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { ISuiteCallbackContext } from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';
import { TestInput } from 'vscode-azureextensionui';
import { ProjectLanguage, projectLanguageSetting, ProjectRuntime, projectRuntimeSetting } from '../../extension.bundle';
import { runForAllTemplateSources } from '../global.test';
import { runWithFuncSetting } from '../runWithSetting';
import { FunctionTesterBase } from './FunctionTesterBase';

// tslint:disable: max-classes-per-file

class JavaScriptFunctionTester extends FunctionTesterBase {
    public language: ProjectLanguage = ProjectLanguage.JavaScript;
    public runtime: ProjectRuntime = ProjectRuntime.v2;

    public async validateFunction(testFolder: string, funcName: string): Promise<void> {
        const functionPath: string = path.join(testFolder, funcName);
        assert.equal(await fse.pathExists(path.join(functionPath, 'index.js')), true, 'index.js does not exist');
        assert.equal(await fse.pathExists(path.join(functionPath, 'function.json')), true, 'function.json does not exist');
    }
}

class TypeScriptFunctionTester extends FunctionTesterBase {
    public language: ProjectLanguage = ProjectLanguage.TypeScript;
    public runtime: ProjectRuntime = ProjectRuntime.v2;

    public async validateFunction(testFolder: string, funcName: string): Promise<void> {
        const functionPath: string = path.join(testFolder, funcName);
        assert.equal(await fse.pathExists(path.join(functionPath, 'index.ts')), true, 'index.ts does not exist');
        assert.equal(await fse.pathExists(path.join(functionPath, 'function.json')), true, 'function.json does not exist');
    }
}

class PythonFunctionTester extends FunctionTesterBase {
    public language: ProjectLanguage = ProjectLanguage.Python;
    public runtime: ProjectRuntime = ProjectRuntime.v2;

    public async validateFunction(testFolder: string, funcName: string): Promise<void> {
        const functionPath: string = path.join(testFolder, funcName);
        assert.equal(await fse.pathExists(path.join(functionPath, '__init__.py')), true, 'run.py does not exist');
        assert.equal(await fse.pathExists(path.join(functionPath, 'function.json')), true, 'function.json does not exist');
    }
}

class PowerShellFunctionTester extends FunctionTesterBase {
    public language: ProjectLanguage = ProjectLanguage.PowerShell;
    public runtime: ProjectRuntime = ProjectRuntime.v2;

    public async validateFunction(testFolder: string, funcName: string): Promise<void> {
        const functionPath: string = path.join(testFolder, funcName);
        assert.equal(await fse.pathExists(path.join(functionPath, 'run.ps1')), true, 'run.ps1 does not exist');
        assert.equal(await fse.pathExists(path.join(functionPath, 'function.json')), true, 'function.json does not exist');
    }
}

addSuite(new JavaScriptFunctionTester());
addSuite(new TypeScriptFunctionTester());
addSuite(new PythonFunctionTester());
addSuite(new PowerShellFunctionTester());

function addSuite(tester: FunctionTesterBase): void {
    // tslint:disable-next-line:max-func-body-length no-function-expression
    suite(`Create ${tester.language} ${tester.runtime} Function Tests`, async function (this: ISuiteCallbackContext): Promise<void> {
        suiteSetup(async () => {
            await tester.initAsync();
        });

        const blobTrigger: string = 'Azure Blob Storage trigger';
        test(blobTrigger, async () => {
            await tester.testCreateFunction(
                blobTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                TestInput.UseDefaultValue // Use default path
            );
        });

        const cosmosDBTrigger: string = 'Azure Cosmos DB trigger';
        test(cosmosDBTrigger, async () => {
            await tester.testCreateFunction(
                cosmosDBTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                'dbName',
                'collectionName',
                TestInput.UseDefaultValue, // Use default for 'create leases if doesn't exist'
                TestInput.UseDefaultValue // Use default lease name
            );
        });

        const eventGridTrigger: string = 'Azure Event Grid trigger';
        test(eventGridTrigger, async () => {
            await tester.testCreateFunction(
                eventGridTrigger
            );
        });

        const httpTrigger: string = 'HTTP trigger';
        test(httpTrigger, async () => {
            await tester.testCreateFunction(
                httpTrigger,
                TestInput.UseDefaultValue // Use default Authorization level
            );
        });

        const queueTrigger: string = 'Azure Queue Storage trigger';
        test(queueTrigger, async () => {
            await tester.testCreateFunction(
                queueTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                TestInput.UseDefaultValue // Use default queue name
            );
        });

        const serviceBusQueueTrigger: string = 'Azure Service Bus Queue trigger';
        test(serviceBusQueueTrigger, async () => {
            await tester.testCreateFunction(
                serviceBusQueueTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                TestInput.UseDefaultValue // Use default queue name
            );
        });

        const serviceBusTopicTrigger: string = 'Azure Service Bus Topic trigger';
        test(serviceBusTopicTrigger, async () => {
            await tester.testCreateFunction(
                serviceBusTopicTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                TestInput.UseDefaultValue, // Use default topic name
                TestInput.UseDefaultValue // Use default subscription name
            );
        });

        const timerTrigger: string = 'Timer trigger';
        test(timerTrigger, async () => {
            await tester.testCreateFunction(
                timerTrigger,
                TestInput.UseDefaultValue // Use default schedule
            );
        });

        // https://github.com/Microsoft/vscode-azurefunctions/blob/master/docs/api.md#create-local-function
        test('createFunction API', async () => {
            await runForAllTemplateSources(async (source) => {
                const templateId: string = `HttpTrigger-${tester.language}`;
                const functionName: string = 'createFunctionApi';
                const authLevel: string = 'Anonymous';
                const projectPath: string = path.join(tester.baseTestFolder, source);
                // Intentionally testing weird casing for authLevel
                await runWithFuncSetting(projectLanguageSetting, tester.language, async () => {
                    await runWithFuncSetting(projectRuntimeSetting, tester.runtime, async () => {
                        await vscode.commands.executeCommand('azureFunctions.createFunction', projectPath, templateId, functionName, { aUtHLevel: authLevel });
                    });
                });
                await tester.validateFunction(projectPath, functionName);
            });
        });
    });
}
