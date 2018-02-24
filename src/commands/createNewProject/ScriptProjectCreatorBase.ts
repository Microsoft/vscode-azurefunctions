/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { ProjectRuntime, TemplateFilter } from '../../ProjectSettings';
import { confirmOverwriteFile } from "../../utils/fs";
import * as fsUtil from '../../utils/fs';
import { funcHostProblemMatcher, funcHostTaskId, funcHostTaskLabel, IProjectCreator } from './IProjectCreator';

// tslint:disable-next-line:no-multiline-string
const gitignore: string = `bin
obj
csx
.vs
edge
Publish

*.user
*.suo
*.cscfg
*.Cache
project.lock.json

/packages
/TestResults

/tools/NuGet.exe
/App_Data
/secrets
/data
.secrets
appsettings.json
local.settings.json
`;

/**
 * Base class for all projects based on a simple script (i.e. JavaScript, C# Script, Bash, etc.) that don't require compilation
 */
export class ScriptProjectCreatorBase implements IProjectCreator {
    public static defaultRuntime: ProjectRuntime = ProjectRuntime.one;
    public readonly runtime: ProjectRuntime = ScriptProjectCreatorBase.defaultRuntime;
    // Default template filter to 'All' since preview langauges have not been 'verified'
    public readonly templateFilter: TemplateFilter = TemplateFilter.All;

    public getTasksJson(): {} {
        return {
            version: '2.0.0',
            tasks: [
                {
                    label: funcHostTaskLabel,
                    identifier: funcHostTaskId,
                    type: 'shell',
                    command: 'func host start',
                    isBackground: true,
                    presentation: {
                        reveal: 'always'
                    },
                    problemMatcher: [
                        funcHostProblemMatcher
                    ]
                }
            ]
        };
    }

    public async addNonVSCodeFiles(functionAppPath: string): Promise<void> {
        const hostJsonPath: string = path.join(functionAppPath, 'host.json');
        if (await confirmOverwriteFile(hostJsonPath)) {
            const hostJson: {} = {};
            await fsUtil.writeFormattedJson(hostJsonPath, hostJson);
        }

        const localSettingsJsonPath: string = path.join(functionAppPath, 'local.settings.json');
        if (await confirmOverwriteFile(localSettingsJsonPath)) {
            const localSettingsJson: {} = {
                IsEncrypted: false,
                Values: {
                    AzureWebJobsStorage: ''
                }
            };
            await fsUtil.writeFormattedJson(localSettingsJsonPath, localSettingsJson);
        }

        const gitignorePath: string = path.join(functionAppPath, '.gitignore');
        if (await confirmOverwriteFile(gitignorePath)) {
            await fse.writeFile(gitignorePath, gitignore);
        }
    }
}
