/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as path from 'path';
import { Disposable } from 'vscode';
import { createFunction, ext, IFunctionTemplate, ProjectLanguage, projectLanguageSetting, ProjectRuntime, projectRuntimeSetting, TemplateFilter, templateFilterSetting, TemplateProvider, TestUserInput } from '../../extension.bundle';
import { runForAllTemplateSources, testFolderPath } from '../global.test';
import { runWithFuncSetting } from '../runWithSetting';

export abstract class FunctionTesterBase implements Disposable {
    public baseTestFolder: string;

    public abstract language: ProjectLanguage;
    public abstract runtime: ProjectRuntime;

    private testedFunctions: string[] = [];

    /**
     * NOTE: The first entry in the returned array is used for validating contents
     */
    public abstract getExpectedPaths(functionName: string): string[];

    public async initAsync(): Promise<void> {
        this.baseTestFolder = path.join(testFolderPath, `createFunction${this.language}${this.runtime}`);
        await runForAllTemplateSources(async (source) => {
            await this.initializeTestFolder(path.join(this.baseTestFolder, source));
        });
    }

    public async dispose(): Promise<void> {
        const templateProvider: TemplateProvider = await ext.templateProviderTask;
        const templates: IFunctionTemplate[] = await templateProvider.getTemplates(this.language, this.runtime, this.baseTestFolder, TemplateFilter.Verified);
        assert.deepEqual(this.testedFunctions.sort(), templates.map(t => t.name).sort(), 'Not all "Verified" templates were tested');
    }

    public async testCreateFunction(templateName: string, ...inputs: string[]): Promise<void> {
        this.testedFunctions.push(templateName);
        await runForAllTemplateSources(async (source) => {
            await this.testCreateFunctionInternal(path.join(this.baseTestFolder, source), templateName, inputs.slice());
        });
    }

    public async validateFunction(testFolder: string, funcName: string, expectedContents: string[]): Promise<void> {
        const expectedPaths: string[] = this.getExpectedPaths(funcName);
        for (const expectedPath of expectedPaths) {
            const filePath: string = path.join(testFolder, expectedPath);
            assert.ok(await fse.pathExists(filePath), `Failed to find expected path "${expectedPath}"`);
        }

        const mainFileName: string = expectedPaths[0];
        const mainFilePath: string = path.join(testFolder, mainFileName);
        const contents: string = (await fse.readFile(mainFilePath)).toString();
        for (const expectedContent of expectedContents) {
            assert.ok(contents.includes(expectedContent) || contents.includes(expectedContent.toLowerCase()), `Failed to find expected content "${expectedContent}" in "${mainFileName}"`);
        }
    }

    private async initializeTestFolder(testFolder: string): Promise<void> {
        await fse.ensureDir(path.join(testFolder, '.vscode'));
        // Pretend to create the parent function project
        await Promise.all([
            fse.writeFile(path.join(testFolder, 'host.json'), '{}'),
            fse.writeFile(path.join(testFolder, 'local.settings.json'), '{ "Values": { "AzureWebJobsStorage": "test" } }'),
            fse.writeFile(path.join(testFolder, '.vscode', 'launch.json'), '')
        ]);
    }

    private async testCreateFunctionInternal(testFolder: string, templateName: string, inputs: string[]): Promise<void> {
        // clone inputs array
        const expectedContents: string[] = inputs.slice(0);

        // Setup common inputs
        const funcName: string = templateName.replace(/ /g, '');
        inputs.unshift(funcName); // Specify the function name
        inputs.unshift(templateName); // Select the function template

        ext.ui = new TestUserInput(inputs);
        await runWithFuncSetting(templateFilterSetting, TemplateFilter.Verified, async () => {
            await runWithFuncSetting(projectLanguageSetting, this.language, async () => {
                await runWithFuncSetting(projectRuntimeSetting, this.runtime, async () => {
                    await createFunction({ properties: {}, measurements: {} }, testFolder);
                });
            });
        });
        assert.equal(inputs.length, 0, `Not all inputs were used: ${inputs}`);

        await this.validateFunction(testFolder, funcName, expectedContents);
    }
}
