/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'path';
import { ProjectLanguage, ProjectRuntime, TemplateFilter } from '../src/ProjectSettings';
import { Template } from '../src/templates/Template';
import { TemplateData } from '../src/templates/TemplateData';

suite('Template Data Tests', () => {
    const templateData: TemplateData = new TemplateData(path.join(__dirname, '..', '..'));

    test('Default JavaScript Templates Count', async () => {
        const templates: Template[] = await templateData.getTemplates('fakeProjectPath', ProjectLanguage.JavaScript, ProjectRuntime.one, TemplateFilter.Verified);
        assert.equal(templates.length, 8);
    });

    test('Default Java Templates Count', async () => {
        const templates: Template[] = await templateData.getTemplates('fakeProjectPath', ProjectLanguage.Java, ProjectRuntime.beta, TemplateFilter.Verified);
        assert.equal(templates.length, 4);
    });

    test('Default CSharp Templates Count', async () => {
        const templates: Template[] = await templateData.getTemplates('fakeProjectPath', ProjectLanguage.CSharp, ProjectRuntime.beta, TemplateFilter.Verified);
        assert.equal(templates.length, 4);
    });
});
