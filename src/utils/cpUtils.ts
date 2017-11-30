/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as commandExist from 'command-exist';
import * as vscode from 'vscode';
import { localize } from '../localize';

export namespace cpUtils {
    export async function executeCommand(outputChannel: vscode.OutputChannel | undefined, workingDirectory: string, command: string, ...args: string[]): Promise<void> {
        await new Promise(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {
            if (!(await commandExist(command))) {
                reject(new Error(localize('azFunc.commandNotFOundError', 'Command "{0}" does not exist.', command)));
                return;
            }
            const options: cp.SpawnOptions = {
                cwd: workingDirectory,
                shell: true
            };
            const childProc: cp.ChildProcess = cp.spawn(command, args, options);

            if (outputChannel) {
                childProc.stdout.on('data', (data: string | Buffer) => outputChannel.append(data.toString()));
                childProc.stderr.on('data', (data: string | Buffer) => outputChannel.append(data.toString()));
            }

            childProc.on('error', reject);
            childProc.on('close', (code: number) => {
                if (code !== 0) {
                    reject(new Error(localize('azFunc.commandError', 'Command "{0} {1}" failed with exit code "{2}".', command, args.toString(), code)));
                } else {
                    resolve();
                }
            });
        });
    }
}
