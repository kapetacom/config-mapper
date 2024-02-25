export type EnvVarMap = { [key: string]: string | undefined };

export function getKapetaEnvVars(processEnvVars: EnvVarMap = process.env): EnvVarMap {
    const envVars: EnvVarMap = {};
    Object.entries(processEnvVars).forEach(([key, value]) => {
        if (key.startsWith('KAPETA_')) {
            envVars[key] = value;
        }
    });

    return envVars;
}

/**
 * Explode an environment variable value into a set of environment variables if it is a JSON object or array.
 *
 * For objects:
 * SOME_KEY='{"a": 1, "b": 2}'
 *
 * Becomes:
 *  - SOME_KEY='{"a": 1, "b": 2}'
 *  - SOME_KEY_A=1
 *  - SOME_KEY_B=2
 *
 * For arrays:
 * SOME_KEY='[1, 2, 3]'
 *
 * Becomes:
 * - SOME_KEY='[1, 2, 3]'
 * - SOME_KEY_0=1
 * - SOME_KEY_1=2
 * - SOME_KEY_2=3
 */
export function explodeEnvValue(key: string, value: string): EnvVarMap {
    const envVars: EnvVarMap = {};

    envVars[key] = value;

    try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== 'object') {
            // Not a JSON object or array - ignore
            return envVars;
        }

        Object.assign(envVars, flattenObject(parsed, `${key}_`));
    } catch (e) {
        // Not a JSON object - ignore
    }

    return envVars;
}

export function explodeEnvVars(processEnvVars: EnvVarMap = process.env): EnvVarMap {
    const exploded: EnvVarMap = {};
    Object.entries(processEnvVars).forEach(([key, value]) => {
        const envVars = explodeEnvValue(key, value || '');
        Object.assign(exploded, envVars);
    });

    return exploded;
}

function flattenObject(obj: EnvVarMap, prefix: string = ''): EnvVarMap {
    const flattened: EnvVarMap = {};
    Object.entries(obj).forEach(([key, value]) => {
        const fullKey = (prefix + toEnvVarName(key)).toUpperCase();
        if (typeof value === 'object') {
            const childPrefix = `${fullKey}_`;
            const flattenedChild = flattenObject(value as EnvVarMap, childPrefix);
            Object.assign(flattened, flattenedChild);
        } else {
            flattened[fullKey] = `${value}`;
        }
    });

    return flattened;
}

export function toEnvVarName(key: string) {
    return key
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toUpperCase()
        .replace(/^[^A-Z0-9_]+/, '')
        .replace(/[^A-Z0-9_]+$/, '')
        .replace(/[^A-Z0-9_]+/g, '_');
}
