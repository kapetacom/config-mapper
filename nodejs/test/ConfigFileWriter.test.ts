import { ConfigFileWriter } from '../src/ConfigFileWriter';

describe('ConfigFileWriter', () => {
    it('can render multiple templates', () => {
        const configFile = new ConfigFileWriter({
            '/tmp/foo': 'Hello ${FOO}',
            '/tmp/bar': 'Goodbye ${BAR}',
        });
        const data = {
            FOO: 'World',
            BAR: 'Cruel World',
        };
        const rendered = configFile.render(data);
        expect(rendered).toEqual({
            '/tmp/foo': 'Hello World',
            '/tmp/bar': 'Goodbye Cruel World',
        });
    });

    it('throws if attempting to render unknown template', () => {
        const configFile = new ConfigFileWriter({
            '/tmp/foo': 'Hello ${FOO}',
            '/tmp/bar': 'Goodbye ${BAR}',
        });

        const data = {};

        expect(() => configFile.renderTemplate('/not/real', data)).toThrow('Template not found: /not/real');
    });

    it('will return a string if attempting to render with missing variable', () => {
        const configFile = new ConfigFileWriter({
            '/tmp/foo': 'Hello ${FOO}',
        });

        const data = {};

        expect(configFile.renderTemplate('/tmp/foo', data)).toBe('Hello ');
    });
});
