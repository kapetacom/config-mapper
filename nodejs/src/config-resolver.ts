import Path from 'path';
import FS from 'node:fs/promises';
import YAML from 'yaml';
import { ConfigFileTemplates, ConfigFileWriter } from './ConfigFileWriter';

export const KAPETA_CONFIG_FILE = 'kapeta.config.yml';

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

export async function renderConfigTemplates(
    data: Record<string, string>,
    baseDir: string = process.cwd()
): Promise<Record<string, string>> {
    const templates = await readConfigTemplates(baseDir);
    const writer = new ConfigFileWriter(templates);

    return writer.render(data);
}

export async function writeConfigTemplates(data: Record<string, string>, baseDir: string = process.cwd()) {
    const templates = await readConfigTemplates(baseDir);
    const writer = new ConfigFileWriter(templates);

    await writer.write(data);
}
