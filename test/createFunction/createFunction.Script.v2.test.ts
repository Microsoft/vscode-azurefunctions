/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { FuncVersion, funcVersionSetting, ProjectLanguage, projectLanguageSetting } from '../../extension.bundle';
import { allTemplateSources } from '../global.test';
import { getRotatingAuthLevel } from '../nightly/getRotatingValue';
import { runWithFuncSetting } from '../runWithSetting';
import { FunctionTesterBase } from './FunctionTesterBase';

class JavaScriptFunctionTester extends FunctionTesterBase {
    public language: ProjectLanguage = ProjectLanguage.JavaScript;

    public getExpectedPaths(functionName: string): string[] {
        return [
            path.join(functionName, 'function.json'),
            path.join(functionName, 'index.js')
        ];
    }
}

class TypeScriptFunctionTester extends FunctionTesterBase {
    public language: ProjectLanguage = ProjectLanguage.TypeScript;

    public getExpectedPaths(functionName: string): string[] {
        return [
            path.join(functionName, 'function.json'),
            path.join(functionName, 'index.ts')
        ];
    }
}

class PythonFunctionTester extends FunctionTesterBase {
    public language: ProjectLanguage = ProjectLanguage.Python;

    public getExpectedPaths(functionName: string): string[] {
        return [
            path.join(functionName, 'function.json'),
            path.join(functionName, '__init__.py')
        ];
    }
}

class PowerShellFunctionTester extends FunctionTesterBase {
    public language: ProjectLanguage = ProjectLanguage.PowerShell;

    public getExpectedPaths(functionName: string): string[] {
        return [
            path.join(functionName, 'function.json'),
            path.join(functionName, 'run.ps1')
        ];
    }
}

addSuitesForVersion(FuncVersion.v2);
addSuitesForVersion(FuncVersion.v3);

function addSuitesForVersion(version: FuncVersion): void {
    for (const source of allTemplateSources) {
        addSuite(new JavaScriptFunctionTester(version, source));
        addSuite(new TypeScriptFunctionTester(version, source));
        addSuite(new PythonFunctionTester(version, source));
        addSuite(new PowerShellFunctionTester(version, source));
    }
}

function addSuite(tester: FunctionTesterBase): void {
    suite(tester.suiteName, function (this: Mocha.Suite): void {
        suiteSetup(async () => {
            await tester.initAsync();
        });

        suiteTeardown(async () => {
            await tester.dispose();
        });

        const blobTrigger: string = 'Azure Blob Storage trigger';
        test(blobTrigger, async () => {
            await tester.testCreateFunction(
                blobTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                'test-path/{name}'
            );
        });

        const cosmosDBTrigger: string = 'Azure Cosmos DB trigger';
        test(cosmosDBTrigger, async () => {
            await tester.testCreateFunction(
                cosmosDBTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                'dbName',
                'collectionName',
                'testLeases',
                'false' // 'create leases if doesn't exist'
            );
        });

        const eventGridTrigger: string = 'Azure Event Grid trigger';
        test(eventGridTrigger, async () => {
            await tester.testCreateFunction(
                eventGridTrigger
            );
        });

        const eventHubTrigger: string = 'Azure Event Hub trigger';
        test(eventHubTrigger, async () => {
            await tester.testCreateFunction(
                eventHubTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                'eventHubName',
                'testConsumerGroup'
            );
        });

        const httpTrigger: string = 'HTTP trigger';
        test(httpTrigger, async () => {
            await tester.testCreateFunction(
                httpTrigger,
                'Admin'
            );
        });

        const queueTrigger: string = 'Azure Queue Storage trigger';
        test(queueTrigger, async () => {
            await tester.testCreateFunction(
                queueTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                'testqueue'
            );
        });

        const serviceBusQueueTrigger: string = 'Azure Service Bus Queue trigger';
        test(serviceBusQueueTrigger, async () => {
            await tester.testCreateFunction(
                serviceBusQueueTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                'testQueue'
            );
        });

        const serviceBusTopicTrigger: string = 'Azure Service Bus Topic trigger';
        test(serviceBusTopicTrigger, async () => {
            await tester.testCreateFunction(
                serviceBusTopicTrigger,
                'AzureWebJobsStorage', // Use existing app setting
                'testTopic',
                'testSubscription'
            );
        });

        const timerTrigger: string = 'Timer trigger';
        test(timerTrigger, async () => {
            await tester.testCreateFunction(
                timerTrigger,
                '0 * * */3 * *'
            );
        });

        function fixDurableLabel(label: string): string {
            if (tester.language === ProjectLanguage.PowerShell) {
                label += ' (preview)';
            }
            return label;
        }

        // Not supported for Custom Handlers
        if (tester.language !== ProjectLanguage.Custom) {
            const durableActivity: string = 'Durable Functions activity';
            test(durableActivity, async () => {
                await tester.testCreateFunction(
                    fixDurableLabel(durableActivity)
                );
            });

            const durableHttpStarter: string = 'Durable Functions HTTP starter';
            test(durableHttpStarter, async () => {
                await tester.testCreateFunction(
                    fixDurableLabel(durableHttpStarter),
                    getRotatingAuthLevel()
                );
            });

            const durableOrchestrator: string = 'Durable Functions orchestrator';
            test(durableOrchestrator, async () => {
                await tester.testCreateFunction(
                    fixDurableLabel(durableOrchestrator)
                );
            });
        }

        // For now - these are not supported in Python
        if (tester.language !== ProjectLanguage.Python) {
            const iotHubTrigger: string = 'IoT Hub (Event Hub)';
            test(iotHubTrigger, async () => {
                await tester.testCreateFunction(
                    iotHubTrigger,
                    'AzureWebJobsStorage', // Use existing app setting
                    'testConsumerGroup'
                );
            });

            const sendGridTrigger: string = 'SendGrid';
            test(iotHubTrigger, async () => {
                await tester.testCreateFunction(
                    sendGridTrigger
                );
            });
        }

        // https://github.com/Microsoft/vscode-azurefunctions/blob/main/docs/api.md#create-local-function
        test('createFunction API (deprecated)', async () => {
            const templateId: string = `HttpTrigger-${tester.language}`;
            const functionName: string = 'createFunctionApi';
            const authLevel: string = 'Anonymous';
            // Intentionally testing weird casing for authLevel
            await runWithFuncSetting(projectLanguageSetting, tester.language, async () => {
                await runWithFuncSetting(funcVersionSetting, tester.version, async () => {
                    await vscode.commands.executeCommand('azureFunctions.createFunction', tester.projectPath, templateId, functionName, { aUtHLevel: authLevel });
                });
            });
            await tester.validateFunction(tester.projectPath, functionName, [authLevel]);
        });
    });
}
