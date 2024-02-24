import {interpolateVariables, interpolateVariablesInValue} from "./dotenv-interpolation";

describe('dotenv-interpolation', () => {

    it('can interpolate values in a string', () => {

        const data = {
            FOO: 'World',
            BAR: 'Cruel World'
        };

        const result = interpolateVariablesInValue('Hello ${FOO}', data);
        expect(result).toEqual('Hello World');

    });

    it('can interpolate nested values', () => {

        const data = {
            TEST1: 'World',
            TEST2: '${TEST1}',
            FOO: '${TEST2}',
            BAR: 'Cruel ${FOO}'
        };

        const result = interpolateVariablesInValue('Hello ${BAR}', data);
        expect(result).toEqual('Hello Cruel World');

    });

    it('can interpolate default values', () => {

        const data = {

        };

        const result = interpolateVariablesInValue('Hello ${NOT_FOUND:-World}', data);
        expect(result).toEqual('Hello World');
    });

    it('can interpolate default values from variable', () => {

        const data = {
            FOO: 'World'
        };

        const result = interpolateVariablesInValue('Hello ${NOT_FOUND:-${FOO}}', data);
        expect(result).toEqual('Hello World');
    });

    it('can interpolate values in a map', () => {
        const data = {
            FOO: 'World',
            BAR: 'Cruel ${FOO}'
        };

        const result = interpolateVariables(data);

        expect(result).toEqual({
            FOO: 'World',
            BAR: 'Cruel World'
        });
    });


})