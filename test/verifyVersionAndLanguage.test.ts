/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { FuncVersion, ProjectLanguage, verifyVersionAndLanguage } from '../extension.bundle';
import { testUserInput } from './global.test';

// tslint:disable-next-line: max-func-body-length
suite('verifyVersionAndLanguage', () => {
    test('Local: ~1, Remote: none', async () => {
        const props: { [name: string]: string } = {};
        await verifyVersionAndLanguage(FuncVersion.v1, ProjectLanguage.JavaScript, props);
        assert.deepEqual(props, {});
    });

    test('Local: ~1, Remote: ~1', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '~1'
        };
        await verifyVersionAndLanguage(FuncVersion.v1, ProjectLanguage.JavaScript, props);
        assert.deepEqual(props, {
            FUNCTIONS_EXTENSION_VERSION: '~1'
        });
    });

    test('Local: ~1, Remote: 1.0.0', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '1.0.0'
        };
        await verifyVersionAndLanguage(FuncVersion.v1, ProjectLanguage.JavaScript, props);
        assert.deepEqual(props, {
            FUNCTIONS_EXTENSION_VERSION: '1.0.0'
        });
    });

    test('Local: ~1, Remote: ~2', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '~2'
        };
        await testUserInput.runWithInputs(['Update remote settings'], async () => {
            await verifyVersionAndLanguage(FuncVersion.v1, ProjectLanguage.JavaScript, props);
        });
        assert.equal(props.FUNCTIONS_EXTENSION_VERSION, '~1');
        assert.ok(props.WEBSITE_NODE_DEFAULT_VERSION); // Verify this exists, but don't actually verify the value since I don't want to update the test every time the default node version changes
    });

    test('Local: ~1, Remote: 2.0.0', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '2.0.0'
        };
        await testUserInput.runWithInputs(['Update remote settings'], async () => {
            await verifyVersionAndLanguage(FuncVersion.v1, ProjectLanguage.JavaScript, props);
        });
        assert.equal(props.FUNCTIONS_EXTENSION_VERSION, '~1');
        assert.ok(props.WEBSITE_NODE_DEFAULT_VERSION);
    });

    test('Local: ~2, Remote: none', async () => {
        const props: { [name: string]: string } = {};
        await verifyVersionAndLanguage(FuncVersion.v2, ProjectLanguage.JavaScript, props);
        assert.deepEqual(props, {});
    });

    test('Local: ~2, Remote: ~2', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '~2'
        };
        await verifyVersionAndLanguage(FuncVersion.v2, ProjectLanguage.JavaScript, props);
        assert.deepEqual(props, {
            FUNCTIONS_EXTENSION_VERSION: '~2'
        });
    });

    test('Local: ~2, Remote: 2.0.0', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '2.0.0'
        };
        await verifyVersionAndLanguage(FuncVersion.v2, ProjectLanguage.JavaScript, props);
        assert.deepEqual(props, {
            FUNCTIONS_EXTENSION_VERSION: '2.0.0'
        });
    });

    test('Local: ~2, Remote: ~1', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '~1'
        };
        await testUserInput.runWithInputs(['Update remote settings'], async () => {
            await verifyVersionAndLanguage(FuncVersion.v2, ProjectLanguage.JavaScript, props);
        });
        assert.equal(props.FUNCTIONS_EXTENSION_VERSION, '~2');
        assert.ok(props.WEBSITE_NODE_DEFAULT_VERSION);
    });

    test('Local: ~2, Remote: 1.0.0', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '1.0.0'
        };
        await testUserInput.runWithInputs(['Update remote settings'], async () => {
            await verifyVersionAndLanguage(FuncVersion.v2, ProjectLanguage.JavaScript, props);
        });
        assert.equal(props.FUNCTIONS_EXTENSION_VERSION, '~2');
        assert.ok(props.WEBSITE_NODE_DEFAULT_VERSION);
    });

    test('Local: ~2/node, Remote: ~2/node', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '~2',
            FUNCTIONS_WORKER_RUNTIME: 'node'
        };
        await verifyVersionAndLanguage(FuncVersion.v2, ProjectLanguage.JavaScript, props);
        assert.deepEqual(props, {
            FUNCTIONS_EXTENSION_VERSION: '~2',
            FUNCTIONS_WORKER_RUNTIME: 'node'
        });
    });

    test('Local: ~2/node, Remote: ~2/dotnet', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '~2',
            FUNCTIONS_WORKER_RUNTIME: 'dotnet'
        };
        await testUserInput.runWithInputs(['Update remote settings'], async () => {
            await verifyVersionAndLanguage(FuncVersion.v2, ProjectLanguage.JavaScript, props);
        });
        assert.equal(props.FUNCTIONS_EXTENSION_VERSION, '~2');
        assert.equal(props.FUNCTIONS_WORKER_RUNTIME, 'node');
        assert.ok(props.WEBSITE_NODE_DEFAULT_VERSION);
    });

    test('Local: ~2/node, Remote: ~1/dotnet', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '~1',
            FUNCTIONS_WORKER_RUNTIME: 'dotnet'
        };
        await testUserInput.runWithInputs(['Update remote settings'], async () => {
            await verifyVersionAndLanguage(FuncVersion.v2, ProjectLanguage.JavaScript, props);
        });
        assert.equal(props.FUNCTIONS_EXTENSION_VERSION, '~2');
        assert.equal(props.FUNCTIONS_WORKER_RUNTIME, 'node');
        assert.ok(props.WEBSITE_NODE_DEFAULT_VERSION);
    });

    test('Local: ~2/unknown, Remote: ~2/dotnet', async () => {
        const props: { [name: string]: string } = {
            FUNCTIONS_EXTENSION_VERSION: '~2',
            FUNCTIONS_WORKER_RUNTIME: 'dotnet'
        };
        await verifyVersionAndLanguage(FuncVersion.v2, <ProjectLanguage>"unknown", props);
        assert.deepEqual(props, {
            FUNCTIONS_EXTENSION_VERSION: '~2',
            FUNCTIONS_WORKER_RUNTIME: 'dotnet'
        });
    });
});
