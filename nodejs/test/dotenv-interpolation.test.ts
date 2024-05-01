import {
    interpolateDotEnv,
    interpolateVariables,
    interpolateVariablesInValue,
    readDotEnv,
} from '../src/dotenv-interpolation';
import { toEnvVar, toEnvVars, toMappedVar, VariableType } from '../src/variable-resolver';

describe('dotenv-interpolation', () => {
    it('can interpolate values in a string', () => {
        const data = toEnvVars({
            FOO: 'World',
            BAR: 'Cruel World',
        });

        const result = interpolateVariablesInValue('Hello ${FOO}', data);
        expect(result).toEqual('Hello World');
    });

    it('can interpolate nested values', () => {
        const data = toEnvVars({
            TEST1: 'World',
            TEST2: '${TEST1}',
            FOO: '${TEST2}',
            BAR: 'Cruel ${FOO}',
        });

        const result = interpolateVariablesInValue('Hello ${BAR}', data);
        expect(result).toEqual('Hello Cruel World');
    });

    it('can merge simple dotenv with env vars', () => {
        const data = readDotEnv(
            'FOO=World',
            toEnvVars({
                BAR: 'test',
            })
        );
        expect(data).toEqual({
            FOO: {
                type: VariableType.MAPPED,
                value: 'World',
            },
            BAR: {
                json: false,
                type: VariableType.ENV,
                value: 'test',
            },
        });
    });

    it('can merge interpolated dotenv with env vars', () => {
        const data = readDotEnv(
            `FOO=\${BAR} World`,
            toEnvVars({
                BAR: 'Cruel',
            })
        );
        expect(data).toEqual({
            FOO: {
                type: VariableType.MAPPED,
                value: 'Cruel World',
            },
            BAR: {
                json: false,
                type: VariableType.ENV,
                value: 'Cruel',
            },
        });
    });

    it('can interpolate dotenv with dotenv', () => {
        const data = readDotEnv(
            `FOO=\${BAR} World\nBAR=Hallo`,
            toEnvVars({
                BAR: 'Cruel',
            })
        );
        expect(data).toEqual({
            FOO: {
                type: VariableType.MAPPED,
                value: 'Hallo World',
            },
            BAR: {
                type: VariableType.MAPPED,
                value: 'Hallo',
            },
        });
    });

    it('can interpolate default values', () => {
        const data = {};

        const result = interpolateVariablesInValue('Hello ${NOT_FOUND:-World}', data);
        expect(result).toEqual('Hello World');
    });

    it('can interpolate default values from variable', () => {
        const data = toEnvVars({
            FOO: 'World',
        });

        const result = interpolateVariablesInValue('Hello ${NOT_FOUND:-${FOO}}', data);
        expect(result).toEqual('Hello World');
    });

    it('can interpolate values in a map', () => {
        const data = toEnvVars({
            FOO: 'World',
            BAR: 'Cruel ${FOO}',
        });

        const result = interpolateVariables(data);

        expect(result).toEqual(
            toEnvVars({
                FOO: 'World',
                BAR: 'Cruel World',
            })
        );
    });

    it('interpolating a dot env files gives mapped variable values', () => {
        const data = toEnvVars({
            KAPETA_FOO: 'World',
            KAPETA_BAR: 'Cruel ${FOO}',
        });

        const dotEnv = toEnvVars({
            FOO: '${KAPETA_FOO}',
            BAR: '${KAPETA_BAR}',
        });

        const result = interpolateDotEnv(dotEnv, data);

        expect(result).toEqual({
            KAPETA_FOO: toEnvVar('World'),
            KAPETA_BAR: toEnvVar('Cruel ${FOO}'),
            FOO: toMappedVar('World'),
            BAR: toMappedVar('Cruel World'),
        });
    });
});
