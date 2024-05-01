import Path from 'path';
import FS from 'node:fs/promises';
import YAML from 'yaml';
import { ConfigFileTemplates, ConfigFileWriter } from './ConfigFileWriter';
import { getAttachmentFromKapetaYML, readConfigContent } from './utils';
import { Variables } from './variable-resolver';

/**
 * The name of the configuration file
 */
export const KAPETA_CONFIG_FILE = 'kapeta.config.yml';

/**
 * Reads the configuration templates from the kapeta.config.yml file
 */
export async function readConfigTemplates(baseDir: string = process.cwd()): Promise<ConfigFileTemplates> {
    const rawYaml = await readConfigContent(KAPETA_CONFIG_FILE, baseDir);
    if (!rawYaml) {
        return {};
    }
    return YAML.parse(rawYaml);
}

/**
 * Gets the paths of the configuration templates from the kapeta.config.yml file
 */
export async function getConfigTemplatePaths(baseDir: string = process.cwd()): Promise<string[]> {
    const templates = await readConfigTemplates(baseDir);
    return Object.keys(templates);
}

/**
 * Renders the configuration templates from the kapeta.config.yml file in-memory
 */
export async function renderConfigTemplates(
    data: Variables,
    baseDir: string = process.cwd()
): Promise<Record<string, string>> {
    const templates = await readConfigTemplates(baseDir);
    const writer = new ConfigFileWriter(templates, baseDir);

    return writer.render(data);
}

/**
 * Writes the configuration templates from the kapeta.config.yml file to the file system
 */
export async function writeConfigTemplates(data: Variables, baseDir: string = process.cwd()) {
    const templates = await readConfigTemplates(baseDir);
    const writer = new ConfigFileWriter(templates, baseDir);

    await writer.write(data);
}
