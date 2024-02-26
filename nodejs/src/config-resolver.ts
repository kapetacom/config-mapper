import Path from 'path';
import FS from 'node:fs/promises';
import YAML from 'yaml';
import { ConfigFileTemplates, ConfigFileWriter } from './ConfigFileWriter';

/**
 * The name of the configuration file
 */
export const KAPETA_CONFIG_FILE = 'kapeta.config.yml';

/**
 * Reads the configuration templates from the kapeta.config.yml file
 */
export async function readConfigTemplates(baseDir: string = process.cwd()): Promise<ConfigFileTemplates> {
    const configPath = Path.join(baseDir, KAPETA_CONFIG_FILE);
    try {
        await FS.access(configPath, FS.constants.F_OK);
    } catch (e) {
        // File does not exist
        return {};
    }
    const rawYaml = await FS.readFile(configPath, 'utf-8');
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
    data: Record<string, string>,
    baseDir: string = process.cwd()
): Promise<Record<string, string>> {
    const templates = await readConfigTemplates(baseDir);
    const writer = new ConfigFileWriter(templates, baseDir);

    return writer.render(data);
}

/**
 * Writes the configuration templates from the kapeta.config.yml file to the file system
 */
export async function writeConfigTemplates(data: Record<string, string>, baseDir: string = process.cwd()) {
    const templates = await readConfigTemplates(baseDir);
    const writer = new ConfigFileWriter(templates, baseDir);

    await writer.write(data);
}
