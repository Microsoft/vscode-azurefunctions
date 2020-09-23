/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppSettingsTreeItem } from "vscode-azureappservice";

export interface AzureFunctionsExtensionApi {
    apiVersion: string;

    revealTreeItem(resourceId: string): Promise<void>;

    createFunction(options: ICreateFunctionOptions): Promise<void>;
    downloadAppSettings(node?: AppSettingsTreeItem): Promise<void>;
    uploadAppSettings(client: ISimpleAppSettingsClient, outputChannel: OutputChannel, workspacePath?: string): Promise<void>;
}

export type ProjectLanguage = 'JavaScript' | 'TypeScript' | 'C#' | 'Python' | 'PowerShell' | 'Java';

export type ProjectVersion = '~1' | '~2' | '~3';

/**
 * The options to use when creating a function. If an option is not specified, the default will be used or the user will be prompted
 */
export interface ICreateFunctionOptions {
    /**
     * The folder containing the Azure Functions project
     */
    folderPath?: string;

    /**
     * The name of the function
     */
    functionName?: string;

    /**
     * The language of the project
     */
    language?: ProjectLanguage;

    /**
     * A filter specifying the langauges to display when creating a project (if there's not already a project)
     */
    languageFilter?: RegExp;

    /**
     * The version of the project. Defaults to the latest GA version
     */
    version?: ProjectVersion;

    /**
     * The id of the template to use.
     * NOTE: The language part of the id is optional. Aka "HttpTrigger" will work just as well as "HttpTrigger-JavaScript"
     */
    templateId?: string;

    /**
     * A case-insensitive object of settings to use for the function
     */
    functionSettings?: {
        [key: string]: string | undefined
    }

    /**
     * If set to true, it will automatically create a new project without prompting (if there's not already a project). Defaults to false
     */
    suppressCreateProjectPrompt?: boolean;

    /**
     * If set to true, it will not try to open the folder after create finishes. Defaults to false
     */
    suppressOpenFolder?: boolean;
}
