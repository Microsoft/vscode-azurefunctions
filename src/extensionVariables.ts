/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OutputChannel } from "vscode";
import { AzureTreeDataProvider, IAzureUserInput } from "vscode-azureextensionui";
import { TemplateData } from "./templates/TemplateData";

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
export namespace ext {
    export let tree: AzureTreeDataProvider;
    export let outputChannel: OutputChannel;
    export let ui: IAzureUserInput;
    export let templateData: TemplateData;
}
