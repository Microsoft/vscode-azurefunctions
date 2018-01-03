/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IUserInterface } from "../../IUserInterface";
import { Template } from "../../templates/Template";

export abstract class AbstractFunctionCreator {
    protected readonly _functionNameRegex: RegExp = /^[a-zA-Z][a-zA-Z\d_\-]*$/;
    protected _functionAppPath: string;
    protected _template: Template;

    constructor(functionAppPath: string, template: Template) {
        this._functionAppPath = functionAppPath;
        this._template = template;
    }

    /**
     * Prompt for any settings that are specific to this creator
     * This includes the function name (Since the name could have different restrictions for different languages)
     */
    public abstract async promptForSettings(ui: IUserInterface): Promise<void>;
    public abstract async createFunction(userSettings: { [propertyName: string]: string }): Promise<string | undefined>;
}
