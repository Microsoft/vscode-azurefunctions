/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, DebugConfiguration, DebugConfigurationProvider, ShellExecution, WorkspaceFolder } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { isFunctionProject } from '../commands/createNewProject/verifyIsProject';
import { hostStartTaskName } from '../constants';
import { IPreDebugValidateResult, preDebugValidate } from './validatePreDebug';

export abstract class FuncDebugProviderBase implements DebugConfigurationProvider {
    protected abstract defaultPortOrPipeName: number | string;
    protected abstract debugConfig: DebugConfiguration;

    private readonly _debugPorts: Map<WorkspaceFolder | undefined, number | undefined> = new Map();

    public abstract getShellExecution(folder: WorkspaceFolder, commandLine: string): Promise<ShellExecution>;

    public async provideDebugConfigurations(folder: WorkspaceFolder | undefined, _token?: CancellationToken): Promise<DebugConfiguration[]> {
        const configs: DebugConfiguration[] | undefined = await callWithTelemetryAndErrorHandling('provideDebugConfigurations', async (context: IActionContext) => {
            context.properties.isActivationEvent = 'true';
            context.suppressErrorDisplay = true;
            context.suppressTelemetry = true;

            const result: DebugConfiguration[] = [];
            if (folder) {
                if (await isFunctionProject(folder.uri.fsPath)) {
                    result.push(this.debugConfig);
                }
            }

            return result;
        });

        // tslint:disable-next-line: strict-boolean-expressions
        return configs || [];
    }

    public async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, _token?: CancellationToken): Promise<DebugConfiguration | undefined> {
        let result: DebugConfiguration | undefined = debugConfiguration;

        await callWithTelemetryAndErrorHandling('resolveDebugConfiguration', async (context: IActionContext) => {
            context.properties.isActivationEvent = 'true';
            context.suppressErrorDisplay = true;
            context.suppressTelemetry = true;

            this._debugPorts.set(folder, <number | undefined>debugConfiguration.port);
            if (debugConfiguration.preLaunchTask === hostStartTaskName) {
                const preDebugResult: IPreDebugValidateResult = await preDebugValidate(debugConfiguration);
                if (!preDebugResult.shouldContinue) {
                    // Stop debugging only in this case
                    result = undefined;
                }
            }
        });

        // Always return the debugConfiguration passed in. If we return undefined we would block debugging and we don't want that.
        return result;
    }

    protected getDebugPortOrPipeName(folder: WorkspaceFolder): number | string {
        // tslint:disable-next-line:strict-boolean-expressions
        return this._debugPorts.get(folder) || this.defaultPortOrPipeName;
    }
}
