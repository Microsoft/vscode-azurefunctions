/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "@azure/arm-appservice";
import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import { AppSettingsTreeItem, IAppSettingsClient } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { localSettingsFileName, viewOutput } from "../../constants";
import { ext } from "../../extensionVariables";
import { ILocalSettingsJson } from "../../funcConfig/local.settings";
import { localize } from "../../localize";
import { confirmOverwriteSettings } from "./confirmOverwriteSettings";
import { decryptLocalSettings } from "./decryptLocalSettings";
import { encryptLocalSettings } from "./encryptLocalSettings";
import { getLocalSettingsFile } from "./getLocalSettingsFile";

export async function uploadAppSettings(context: IActionContext, node?: AppSettingsTreeItem, workspacePath?: string): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<AppSettingsTreeItem>(AppSettingsTreeItem.contextValue, context);
    }

    const client: IAppSettingsClient = node.client;
    await node.runWithTemporaryDescription(localize('uploading', 'Uploading...'), async () => {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: localize('uploadingSettingsTo', 'Uploading settings to "{0}"...', client.fullName) }, async () => {
            await uploadAppSettingsInternal(context, client, ext.outputChannel, workspacePath);
        });
    });
}

export async function uploadAppSettingsInternal(context: IActionContext, client: ISimpleAppSettingsClient, outputChannel: vscode.OutputChannel, workspacePath?: string): Promise<void> {
    const message: string = localize('selectLocalSettings', 'Select the local settings file to upload.');
    const localSettingsPath: string = await getLocalSettingsFile(message, workspacePath);
    const localSettingsUri: vscode.Uri = vscode.Uri.file(localSettingsPath);

    let localSettings: ILocalSettingsJson = <ILocalSettingsJson>await fse.readJson(localSettingsPath);
    if (localSettings.IsEncrypted) {
        await decryptLocalSettings(context, localSettingsUri);
        try {
            localSettings = <ILocalSettingsJson>await fse.readJson(localSettingsPath);
        } finally {
            await encryptLocalSettings(context, localSettingsUri);
        }
    }

    if (localSettings.Values) {
        const remoteSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
        if (!remoteSettings.properties) {
            remoteSettings.properties = {};
        }

        const uploadSettings: string = localize('uploadingSettings', 'Uploading settings...');
        // tslint:disable-next-line: no-unsafe-any
        hasOwnProperty(outputChannel, 'appendLog') ? outputChannel.appendLog(uploadSettings, { resourceName: client.fullName }) : outputChannel.appendLine(uploadSettings);
        await confirmOverwriteSettings(localSettings.Values, remoteSettings.properties, client.fullName);

        await client.updateApplicationSettings(remoteSettings);

        ext.outputChannel.appendLog(localize('uploadedSettings', 'Successfully uploaded settings.'), { resourceName: client.fullName });
        // don't wait
        vscode.window.showInformationMessage(localize('uploadedSettingsTo', 'Successfully uploaded settings to "{0}".', client.fullName), viewOutput).then(async result => {
            if (result === viewOutput) {
                ext.outputChannel.show();
            }
        });
    } else {
        throw new Error(localize('noSettings', 'No settings found in "{0}".', localSettingsFileName));
    }

}

export interface ISimpleAppSettingsClient {
    fullName: string;
    listApplicationSettings(): Promise<IStringDictionary>;
    updateApplicationSettings(appSettings: IStringDictionary): Promise<IStringDictionary>;
}

export interface IStringDictionary {
    properties?: { [propertyName: string]: string };
}

function hasOwnProperty<X extends {}, Y extends PropertyKey>
    // tslint:disable-next-line:no-any
    (obj: X, prop: Y): obj is X & Record<Y, any> {
    return obj.hasOwnProperty(prop);
}
