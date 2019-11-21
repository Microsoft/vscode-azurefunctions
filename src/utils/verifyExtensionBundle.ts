/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { parseError } from 'vscode-azureextensionui';
import { IBindingWizardContext } from '../commands/addBinding/IBindingWizardContext';
import { IFunctionWizardContext } from '../commands/createFunction/IFunctionWizardContext';
import { hostFileName, ProjectLanguage, extensionsCsprojFilename } from '../constants';
import { IHostJsonV2 } from '../funcConfig/host';
import { FuncVersion } from '../FuncVersion';
import { localize } from '../localize';
import { IBindingTemplate } from '../templates/IBindingTemplate';
import { IFunctionTemplate } from '../templates/IFunctionTemplate';
import { bundleFeedUtils } from './bundleFeedUtils';
import { writeFormattedJson } from './fs';

export async function verifyExtensionBundle(context: IFunctionWizardContext | IBindingWizardContext, template: IFunctionTemplate | IBindingTemplate): Promise<void> {
    if (await shouldUseExtensionBundle(context, template)) {
        const hostFilePath: string = path.join(context.projectPath, hostFileName);
        let hostJson: IHostJsonV2;
        try {
            hostJson = <IHostJsonV2>await fse.readJSON(hostFilePath);
        } catch (error) {
            throw new Error(localize('failedToParseHostJson', 'Failed to parse {0}: {1}', hostFileName, parseError(error).message));
        }

        if (!hostJson.extensionBundle) {
            let versionRange: string;
            try {
                versionRange = await bundleFeedUtils.getLatestVersionRange();
            } catch {
                versionRange = bundleFeedUtils.defaultVersionRange;
            }

            hostJson.extensionBundle = {
                id: bundleFeedUtils.defaultBundleId,
                version: versionRange
            };
            await writeFormattedJson(hostFilePath, hostJson);
        }
    }
}

async function shouldUseExtensionBundle(context: IFunctionWizardContext, template: IFunctionTemplate | IBindingTemplate): Promise<boolean> {
    // v1 doesn't support bundles
    // http and timer triggers don't need a bundle
    // F# and C# specify extensions as dependencies in their proj file instead of using a bundle
    if (context.version === FuncVersion.v1 ||
        !bundleFeedUtils.isBundleTemplate(template) ||
        context.language === ProjectLanguage.CSharp || context.language === ProjectLanguage.FSharp) {
        return false;
    }

    // Old projects setup to use "func extensions install" shouldn't use a bundle because it could lead to duplicate or conflicting binaries
    try {
        const extensionsCsprojFilePath: string = path.join(context.projectPath, extensionsCsprojFilename);
        if (await fse.pathExists(extensionsCsprojFilePath)) {
            return false;
        }
    } catch {
        // ignore and use bundles (the default for new projects)
    }

    return true;
}
