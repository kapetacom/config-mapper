/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

// This is mostly copied from:
// https://github.com/motdotla/dotenv-expand/blob/master/lib/main.js

const DOTENV_SUBSTITUTION_REGEX =
    /(\\)?(\$)(?!\()(\{?)([\w.]+)(?::?-((?:\$\{(?:\$\{(?:\$\{[^}]*}|[^}])*}|[^}])*}|[^}])+))?(}?)/gi;

function resolveEscapeSequences(value: string) {
    return value.replace(/\\\$/g, '$');
}

export function interpolateVariablesInValue(value: string, data: Record<string, string>): string {
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

export function interpolateVariables(data: Record<string, string>) {
    const output: Record<string, string> = {};
    for (const key in data) {
        let value = data[key];
        value = interpolateVariablesInValue(value, data);
        output[key] = resolveEscapeSequences(value);
    }
    return output;
}

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
