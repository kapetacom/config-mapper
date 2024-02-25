import FS from 'node:fs/promises';
import { interpolateVariablesInValue } from './dotenv-interpolation';
import * as Path from 'path';

export type ConfigFileTemplates = {
    [path: string]: string;
};

export class ConfigFileWriter {
    private readonly templates: ConfigFileTemplates;

    constructor(templates: ConfigFileTemplates) {
        this.templates = templates;
    }

    public render(data: Record<string, string>) {
        const rendered: { [path: string]: string } = {};
        for (const path in this.templates) {
            rendered[path] = this.renderTemplate(path, data);
        }
        return rendered;
    }

    public async write(data: Record<string, string>) {
        const rendered = this.render(data);
        const entries = Object.entries(rendered);
        for (const [path, value] of entries) {
            console.log(`Writing configuration to ${path}`);
            await FS.mkdir(Path.dirname(path), { recursive: true });
            await FS.writeFile(path, value);
        }
    }

    public renderTemplate(path: string, data: Record<string, string>): string {
        if (!(path in this.templates)) {
            throw new Error(`Template not found: ${path}`);
        }

        const template = this.templates[path];

        return interpolateVariablesInValue(template, data);
    }
}
