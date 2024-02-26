import { explodeEnvValue, getKapetaEnvVars, toEnvVarName } from '../src/environment';

describe('environment', () => {
    it('can filter out all kapeta env vars from map', () => {
        // Arrange
        const processEnvVars = {
            KAPETA_ENV: 'development',
            KAPETA_API_KEY: '1234',
            SOME_OTHER_VAR: '5678',
        };
        const expected = {
            KAPETA_ENV: 'development',
            KAPETA_API_KEY: '1234',
        };

        const result = getKapetaEnvVars(processEnvVars);

        expect(result).toEqual(expected);
    });

    it('can explode a JSON environment variable value into a set of environment variables', () => {
        // Arrange
        const key = 'KAPETA_ENV';
        const value = JSON.stringify({
            a: 1,
            b: 2,
            embedded: {
                c: 3,
                d: 4,
            },
            array: [
                {
                    one: 'FIRST ONE',
                    two: 'FIRST TWO',
                    three: true,
                },
                {
                    one: 'SECOND ONE',
                    two: 'SECOND TWO',
                    three: false,
                },
            ],
        });

        const expected = {
            KAPETA_ENV: value,
            KAPETA_ENV_A: '1',
            KAPETA_ENV_B: '2',
            KAPETA_ENV_EMBEDDED_C: '3',
            KAPETA_ENV_EMBEDDED_D: '4',
            KAPETA_ENV_ARRAY_0_ONE: 'FIRST ONE',
            KAPETA_ENV_ARRAY_0_TWO: 'FIRST TWO',
            KAPETA_ENV_ARRAY_0_THREE: 'true',
            KAPETA_ENV_ARRAY_1_ONE: 'SECOND ONE',
            KAPETA_ENV_ARRAY_1_TWO: 'SECOND TWO',
            KAPETA_ENV_ARRAY_1_THREE: 'false',
        };

        const result = explodeEnvValue(key, value);

        expect(result).toEqual(expected);
    });

    it('ignores non-JSON environment variable values', () => {
        // Arrange
        const key = 'KAPETA_ENV';
        const value = 'development';

        const expected = {
            KAPETA_ENV: value,
        };

        const result = explodeEnvValue(key, value);

        expect(result).toEqual(expected);
    });

    it('ignores non-JSON-Object environment variable values', () => {
        // Arrange
        const key = 'KAPETA_ENV';
        const value = 'true';

        const expected = {
            KAPETA_ENV: value,
        };

        const result = explodeEnvValue(key, value);

        expect(result).toEqual(expected);
    });

    it('can convert a string into a valid environment variable name', () => {
        expect(toEnvVarName('SOME_KEY')).toEqual('SOME_KEY');
        expect(toEnvVarName('more:here')).toEqual('MORE_HERE');
        expect(toEnvVarName('/more-here')).toEqual('MORE_HERE');
        expect(toEnvVarName('$$more-here')).toEqual('MORE_HERE');
        expect(toEnvVarName('more-here/')).toEqual('MORE_HERE');
        expect(toEnvVarName('$$more-here$$')).toEqual('MORE_HERE');
        expect(toEnvVarName('moreHereTest')).toEqual('MORE_HERE_TEST');
    });
});
