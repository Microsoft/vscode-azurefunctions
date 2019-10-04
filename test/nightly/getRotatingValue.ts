/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

let authCount: number = getStartingIndex();
const authLevels: string[] = ['Anonymous', 'Function', 'Admin'];
export function getRotatingAuthLevel(): string {
    authCount += 1;
    return authLevels[authCount % authLevels.length];
}

let locationCount: number = getStartingIndex();
const locations: string[] = ['Australia East', 'East Asia', 'East US', 'North Europe', 'South Central US', 'Southeast Asia', 'UK South', 'West Europe'];
export function getRotatingLocation(): string {
    locationCount += 1;
    return locations[locationCount % locations.length];
}

/**
 * Adds a little more spice to the rotation
 */
function getStartingIndex(): number {
    if (process.platform === 'darwin') {
        return 0;
    } else if (process.platform === 'win32') {
        return 1;
    } else {
        return 2;
    }
}
