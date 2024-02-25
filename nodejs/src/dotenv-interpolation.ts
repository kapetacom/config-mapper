/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */
import Path from "path";
import FS from "node:fs/promises";

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
export function interpolateVariablesInValue(value: string, data: Record<string, string>): string {
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
                    if (data[key] === value) {
                        return data[key];
                    } else {
                        // scenario: PASSWORD_EXPAND_NESTED=${PASSWORD_EXPAND}
                        return interpolateVariablesInValue(data[key], data);
                    }
                }

                if (defaultValue) {
                    if (defaultValue.startsWith('$')) {
                        return interpolateVariablesInValue(defaultValue, data);
                    } else {
                        return defaultValue;
                    }
                }

                throw new Error(`Data not found for key: ${key}`);
            }
        }
    );
}

/**
 * Interpolate properties in a data map
 */
export function interpolateVariables(data: Record<string, string>) {
    const output: Record<string, string> = {};
    for (const key in data) {
        let value = data[key];
        value = interpolateVariablesInValue(value, data);
        output[key] = resolveEscapeSequences(value);
    }
    return output;
}

/**
 * Interpolate variables for the output of a dotenv file with both dotenv and data variables
 */
export function interpolateDotEnv(dotEnv: Record<string, string>, data: Record<string, string>) {
    const output: Record<string, string> = {
        ...data,
    };
    for (const key in dotEnv) {
        let value = dotEnv[key];
        value = interpolateVariablesInValue(value, {
            ...output,
            ...dotEnv,
        });
        output[key] = resolveEscapeSequences(value);
    }
    return output;
}


export async function writeDotEnvFile(kapetaVariables: Record<string, string>, baseDir: string = process.cwd()) {
    let dotEnv = '';
    Object.entries(kapetaVariables).forEach(([key, value]) => {
        dotEnv += `${key}=${JSON.stringify(value)}\n`;
    });
    const dotEnvPath = Path.join(baseDir, DOTENV_FILE);
    console.log('Writing environment variables to %s', DOTENV_FILE);
    await FS.writeFile(dotEnvPath, dotEnv);
}