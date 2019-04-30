/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { AzureWizardPromptStep, ISubscriptionWizardContext, IWizardOptions, StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication } from 'vscode-azureextensionui';
import { isWindows, localSettingsFileName } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { IAzureWebJobsStorageWizardContext } from './IAzureWebJobsStorageWizardContext';

export class AzureWebJobsStoragePromptStep<T extends IAzureWebJobsStorageWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(wizardContext: T): Promise<void> {
        const selectAccount: MessageItem = { title: localize('selectAzureAccount', 'Select storage account') };
        const useEmulator: MessageItem = { title: localize('userEmulator', 'Use local emulator') };
        const skipForNow: MessageItem = { title: localize('skipForNow', 'Skip for now') };

        const message: string = localize('selectAzureWebJobsStorage', 'AzureWebJobsStorage must be set in "{0}" to debug non-HTTP triggers locally.', localSettingsFileName);

        const buttons: MessageItem[] = [selectAccount];
        if (isWindows) {
            // Only show on Windows until this is fixed: https://github.com/Microsoft/vscode-azurefunctions/issues/1245
            buttons.push(useEmulator);
        }
        buttons.push(skipForNow);

        const result: MessageItem = await ext.ui.showWarningMessage(message, { modal: true }, ...buttons);
        if (result === selectAccount) {
            wizardContext.azureWebJobsStorageType = 'azure';
        } else if (result === useEmulator) {
            wizardContext.azureWebJobsStorageType = 'emulator';
        }

        // tslint:disable-next-line: strict-boolean-expressions
        wizardContext.actionContext.properties.azureWebJobsStorageType = wizardContext.azureWebJobsStorageType || 'skipForNow';
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.azureWebJobsStorageType;
    }

    public async getSubWizard(wizardContext: T): Promise<IWizardOptions<T & ISubscriptionWizardContext> | undefined> {
        if (wizardContext.azureWebJobsStorageType === 'azure') {
            const promptSteps: AzureWizardPromptStep<T & ISubscriptionWizardContext>[] = [];

            const subscriptionPromptStep: AzureWizardPromptStep<ISubscriptionWizardContext> | undefined = await ext.tree.getSubscriptionPromptStep(wizardContext);
            if (subscriptionPromptStep) {
                promptSteps.push(subscriptionPromptStep);
            }

            promptSteps.push(new StorageAccountListStep(
                { // INewStorageAccountDefaults
                    kind: StorageAccountKind.Storage,
                    performance: StorageAccountPerformance.Standard,
                    replication: StorageAccountReplication.LRS
                },
                { // IStorageAccountFilters
                    kind: [StorageAccountKind.BlobStorage],
                    performance: [StorageAccountPerformance.Premium],
                    replication: [StorageAccountReplication.ZRS],
                    learnMoreLink: 'https://aka.ms/Cfqnrc'
                }
            ));

            return { promptSteps };
        } else {
            return undefined;
        }
    }
}
