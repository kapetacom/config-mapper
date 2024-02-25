import FS from 'node:fs/promises';
import { interpolateVariablesInValue } from './dotenv-interpolation';
import * as Path from 'path';

export type ConfigFileTemplates = {
    [path: string]: string;
};

/**
 * Renders or writes configuration files from templates
 *
 * This class is used to render configuration files from templates and write them to the file system
 *
 * It will interpolate variables in the templates using the provided data.
 * The interpolations are similar to those used in dotenv files
 */
export class ConfigFileWriter {
    private readonly templates: ConfigFileTemplates;

    /**
     * Expected to be called with the parsed YAML from a kapeta.config.yml file
     *
     * The keys are the file paths and the values are the templates
     *
     * E.g.:
     * config/app.conf: |-
     *  server.port=${PORT}
     *  server.host=${HOST}
     */
    constructor(templates: ConfigFileTemplates) {
        this.templates = templates;
    }

    /**
     * Renders the configuration in-memory for the provided data
     */
    public render(data: Record<string, string>) {
        const rendered: { [path: string]: string } = {};
        for (const path in this.templates) {
            rendered[path] = this.renderTemplate(path, data);
        }
        return rendered;
    }

    /**
     * Writes the rendered configuration to the file system for the provided data
     */
    public async write(data: Record<string, string>) {
        const rendered = this.render(data);
        const entries = Object.entries(rendered);
        for (const [path, value] of entries) {
            console.log(`Writing configuration to ${path}`);
            await FS.mkdir(Path.dirname(path), { recursive: true });
            await FS.writeFile(path, value);
        }
    }

    /**
     * Renders a single template
     */
    public renderTemplate(path: string, data: Record<string, string>): string {
        if (!(path in this.templates)) {
            throw new Error(`Template not found: ${path}`);
        }

        const template = this.templates[path];

        return interpolateVariablesInValue(template, data);
    }
}
