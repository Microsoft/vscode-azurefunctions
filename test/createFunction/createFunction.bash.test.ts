/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { IHookCallbackContext } from 'mocha';
import * as path from 'path';
import { ScriptProjectCreatorBase } from '../../src/commands/createNewProject/ScriptProjectCreatorBase';
import { ProjectLanguage, ProjectRuntime } from '../../src/ProjectSettings';
import { FunctionTesterBase } from './FunctionTesterBase';

class BashFunctionTester extends FunctionTesterBase {
    protected _language: ProjectLanguage = ProjectLanguage.Bash;
    protected _runtime: ProjectRuntime = ScriptProjectCreatorBase.defaultRuntime;

    public async validateFunction(testFolder: string, funcName: string): Promise<void> {
        const functionPath: string = path.join(testFolder, funcName);
        assert.equal(await fse.pathExists(path.join(functionPath, 'run.sh')), true, 'run.sh does not exist');
        assert.equal(await fse.pathExists(path.join(functionPath, 'function.json')), true, 'function.json does not exist');
    }
}

suite('Create Bash Function Tests', async () => {
    const tester: BashFunctionTester = new BashFunctionTester();

    suiteSetup(async () => {
        await tester.initAsync();
    });

    // tslint:disable-next-line:no-function-expression
    suiteTeardown(async function (this: IHookCallbackContext): Promise<void> {
        this.timeout(15 * 1000);
        await tester.dispose();
    });

    const queueTrigger: string = 'Queue trigger';
    test(queueTrigger, async () => {
        await tester.testCreateFunction(
            queueTrigger,
            undefined, // New App Setting
            'connectionStringKey4',
            'connectionString',
            undefined // Use default queue name
        );
    });
});
