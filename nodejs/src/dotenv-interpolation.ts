/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */
import Path from 'path';
import FS from 'node:fs/promises';
import {toMappedVar, VariableInfo, Variables} from "./variable-resolver";

export const DOTENV_FILE = '.env';

// This is mostly copied from:
// https://github.com/motdotla/dotenv-expand/blob/master/lib/main.js

const DOTENV_SUBSTITUTION_REGEX =
    /(\\)?(\$)(?!\()(\{?)([\w.]+)(?::?-((?:\$\{(?:\$\{(?:\$\{[^}]*}|[^}])*}|[^}])*}|[^}])+))?(}?)/gi;

/**
 * Resolve escape sequences in a value (e.g. \$ -> $)
 */
function resolveEscapeSequences(value: string) {
    return value.replace(/\\\$/g, '$');
}

/**
 * Interpolate variables in a specific value given the data map
 */
export function interpolateVariablesInValue(value: string, data: Variables): string {
    if (!value || !value.replace) {
        return value;
    }

    return value.replace(
        DOTENV_SUBSTITUTION_REGEX,
        (match, escaped, dollarSign, openBrace, key, defaultValue, closeBrace) => {
            if (escaped === '\\') {
                return match.slice(1);
            } else {
                if (data[key]) {
                    // avoid recursion from EXPAND_SELF=$EXPAND_SELF
                    if (data[key].value === value) {
                        return data[key];
                    } else {
                        // scenario: PASSWORD_EXPAND_NESTED=${PASSWORD_EXPAND}
                        return interpolateVariablesInValue(data[key].value, data);
                    }
                }

                if (defaultValue) {
                    if (defaultValue.startsWith('$')) {
                        return interpolateVariablesInValue(defaultValue, data);
                    } else {
                        return defaultValue;
                    }
                }

                console.warn(`Data not found for key: ${key}`);

                return '';
            }
        }
    );

}

/**
 * Interpolate properties in a data map
 */
export function interpolateVariables(data: Variables) {
    const output: Variables = {};
    for (const key in data) {
        let variable = data[key];
        variable.value = interpolateVariablesInValue(variable.value, data);
        variable.value = resolveEscapeSequences(variable.value);
        output[key] = variable;
    }
    return output;
}

/**
 * Interpolate variables for the output of a dotenv file with both dotenv and data variables
 */
export function interpolateDotEnv(dotEnv: Variables, data: Variables) {
    const output: Variables = {
        ...data,
    };
    for (const key in dotEnv) {
        let variable = dotEnv[key];
        const value = interpolateVariablesInValue(variable.value, {
            ...output,
            ...dotEnv,
        });
        output[key] = toMappedVar(resolveEscapeSequences(value));
    }
    return output;
}

export async function writeEnvConfigFile(kapetaVariables: Variables, path:string) {
    let values : Record<string,string> = {};
    Object.entries(kapetaVariables).forEach(([key, value]) => {
        values[key] = value.value
    });

    console.log('Writing config variables to %s', path);
    const baseDir = Path.dirname(path);
    await FS.mkdir(baseDir, {recursive: true});
    await FS.writeFile(path, JSON.stringify(values));
}


export async function writeDotEnvFile(kapetaVariables: Variables, baseDir: string = process.cwd(), filename = DOTENV_FILE) {
    let dotEnv = '';
    Object.entries(kapetaVariables).forEach(([key, value]) => {
        dotEnv += `${key}=${JSON.stringify(value.value)}\n`;
    });
    const dotEnvPath = Path.join(baseDir, filename);
    console.log('Writing environment variables to %s', filename);
    await FS.writeFile(dotEnvPath, dotEnv);

    return dotEnvPath;
}
