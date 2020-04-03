/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { Progress } from 'vscode';
import * as xml2js from 'xml2js';
import { localize } from '../../../localize';
import { confirmOverwriteFile } from "../../../utils/fs";
import { requestUtils } from '../../../utils/requestUtils';
import { IProjectWizardContext } from '../IProjectWizardContext';
import { ScriptProjectCreateStep } from './ScriptProjectCreateStep';

const profileps1FileName: string = 'profile.ps1';
const requirementspsd1FileName: string = 'requirements.psd1';
const profileps1: string = `# Azure Functions profile.ps1
#
# This profile.ps1 will get executed every "cold start" of your Function App.
# "cold start" occurs when:
#
# * A Function App starts up for the very first time
# * A Function App starts up after being de-allocated due to inactivity
#
# You can define helper functions, run commands, or specify environment variables
# NOTE: any variables defined that are not environment variables will get reset after the first execution

# Authenticate with Azure PowerShell using MSI.
# Remove this if you are not planning on using MSI or Azure PowerShell.
if ($env:MSI_SECRET -and (Get-Module -ListAvailable Az.Accounts)) {
    Connect-AzAccount -Identity
}

# Uncomment the next line to enable legacy AzureRm alias in Azure PowerShell.
# Enable-AzureRmAlias

# You can also define functions or aliases that can be referenced in any of your PowerShell functions.
`;

function requirementspsd1(majorVersion: number): string {
    return `# This file enables modules to be automatically managed by the Functions service.
# See https://aka.ms/functionsmanageddependency for additional information.
#
@{
    'Az' = '${majorVersion}.*'
}`;
}

const requirementspsd1Offine: string = `# This file enables modules to be automatically managed by the Functions service.
# See https://aka.ms/functionsmanageddependency for additional information.
#
@{
    # For latest supported version, go to 'https://www.powershellgallery.com/packages/Az'. Uncomment the next line and replace the MAJOR_VERSION, e.g., 'Az' = '3.*'
    # 'Az' = 'MAJOR_VERSION.*'
}`;

export class PowerShellProjectCreateStep extends ScriptProjectCreateStep {
    protected supportsManagedDependencies: boolean = true;

    private readonly azModuleName: string = 'Az';
    private readonly azModuleGalleryUrl: string = `https://aka.ms/PwshPackageInfo?id='${this.azModuleName}'`;

    public async executeCore(context: IProjectWizardContext, progress: Progress<{ message?: string | undefined; increment?: number | undefined }>): Promise<void> {
        await super.executeCore(context, progress);

        const profileps1Path: string = path.join(context.projectPath, profileps1FileName);
        if (await confirmOverwriteFile(profileps1Path)) {
            await fse.writeFile(profileps1Path, profileps1);
        }

        const majorVersion: number | undefined = await this.tryGetLatestAzModuleMajorVersion(progress);
        if (majorVersion !== undefined) {
            progress.report({
                message: localize('successfullyConnected', 'Successfully retrieved {0} information from PowerShell Gallery', this.azModuleName)
            });
        } else {
            progress.report({
                message: localize('failedToConnect', 'Failed to get {0} module version. Edit the requirements.psd1 file when the powershellgallery.com is accessible.', this.azModuleName)
            });
        }

        const requirementspsd1Path: string = path.join(context.projectPath, requirementspsd1FileName);
        if (await confirmOverwriteFile(requirementspsd1Path)) {
            if (majorVersion !== undefined) {
                await fse.writeFile(requirementspsd1Path, requirementspsd1(majorVersion));
            } else {
                await fse.writeFile(requirementspsd1Path, requirementspsd1Offine);
            }
        }
    }

    private async tryGetLatestAzModuleMajorVersion(progress: Progress<{ message?: string | undefined; increment?: number | undefined }>): Promise<number | undefined> {
        progress.report({
            message: localize('connecting', 'Connecting to PowerShell Gallery...')
        });

        try {
            const xmlResult: string = await this.getPSGalleryAzModuleInfo();
            const versionResult: string = await this.parseLatestAzModuleVersion(xmlResult);
            const [major]: string[] = versionResult.split('.');
            return parseInt(major);
        } catch {
            return undefined;
        }
    }

    private async getPSGalleryAzModuleInfo(): Promise<string> {
        const request: requestUtils.Request = await requestUtils.getDefaultRequestWithTimeout(this.azModuleGalleryUrl, undefined, 'GET');
        return await requestUtils.sendRequest(request);
    }

    private async parseLatestAzModuleVersion(azModuleInfo: string): Promise<string> {
        const moduleInfo: string = await new Promise((
            resolve: (ret: string) => void,
            // tslint:disable-next-line:no-any
            rejects: (reason: any) => void): void => {
            // tslint:disable-next-line:no-any
            xml2js.parseString(azModuleInfo, { explicitArray: false }, (err: any, result: string): void => {
                if (err) {
                    rejects(err);
                } else {
                    resolve(result);
                }
            });
        });

        // tslint:disable-next-line:no-string-literal no-unsafe-any
        if (moduleInfo['feed'] && moduleInfo['feed']['entry'] && Array.isArray(moduleInfo['feed']['entry'])) {
            // tslint:disable-next-line:no-string-literal no-unsafe-any
            const releasedVersions: string[] = moduleInfo['feed']['entry']
                // tslint:disable-next-line:no-string-literal no-unsafe-any
                .filter(entry => entry['m:properties']['d:IsPrerelease']['_'] === 'false')
                // tslint:disable-next-line:no-string-literal no-unsafe-any
                .map(entry => entry['m:properties']['d:Version']);

            // Select the latest version
            if (releasedVersions.length > 0) {
                const lastIndex: number = releasedVersions.length - 1;
                return releasedVersions[lastIndex];
            }
        }

        // If no version is found, throw exception
        throw new Error(`Failed to parse latest Az module version ${azModuleInfo}`);
    }
}
