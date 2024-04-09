import {interpolateDotEnv, interpolateVariables, interpolateVariablesInValue} from '../src/dotenv-interpolation';
import {toEnvVar, toEnvVars, toMappedVar} from "../src/variable-resolver";

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

        expect(result).toEqual(toEnvVars({
            FOO: 'World',
            BAR: 'Cruel World',
        }));
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
