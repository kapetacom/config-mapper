import FS from 'node:fs/promises';
import { interpolateVariablesInValue } from './dotenv-interpolation';
import * as Path from 'path';
import {Variables} from "./variable-resolver";

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
    private readonly baseDir: string;

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
    constructor(templates: ConfigFileTemplates, baseDir: string = process.cwd()) {
        this.templates = templates;
        this.baseDir = baseDir;
    }

    /**
     * Renders the configuration in-memory for the provided data
     */
    public render(data: Variables) {
        const rendered: { [path: string]: string } = {};
        for (const path in this.templates) {
            rendered[path] = this.renderTemplate(path, data);
        }
        return rendered;
    }

    /**
     * Writes the rendered configuration to the file system for the provided data
     */
    public async write(data: Variables) {
        const rendered = this.render(data);
        const entries = Object.entries(rendered);
        for (const [path, value] of entries) {
            console.log(`Writing configuration to ${path}`);
            const fullPath = Path.join(this.baseDir, path);
            await FS.mkdir(Path.dirname(fullPath), { recursive: true });
            await FS.writeFile(fullPath, value);
        }
    }

    /**
     * Renders a single template
     */
    public renderTemplate(path: string, data: Variables): string {
        if (!(path in this.templates)) {
            throw new Error(`Template not found: ${path}`);
        }

        const template = this.templates[path];

        return interpolateVariablesInValue(template, data);
    }
}
