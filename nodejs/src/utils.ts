import Path from 'path';
import FS from 'node:fs/promises';
import { resolveKapetaVariables } from './variable-resolver';
import { KAPETA_CONFIG_FILE, writeConfigTemplates } from './config-resolver';
import { spawn } from '@kapeta/nodejs-process';
import { writeDotEnvFile } from './dotenv-interpolation';
import { ConfigFileTemplates } from './ConfigFileWriter';
import YAML from 'yaml';
import { Attachment, Kind } from '@kapeta/schemas';
import {getAttachment} from "./attachments";

export const KAPETA_YML = 'kapeta.yml';

export async function readKapetaYML(baseDir: string = process.cwd()): Promise<Kind> {
    const ymlPath = Path.join(baseDir, KAPETA_YML);
    try {
        await FS.access(ymlPath, FS.constants.F_OK);
    } catch (e) {
        // File does not exist
        throw new Error(`Could not find kapeta.yml in ${baseDir}`);
    }
    const rawYaml = await FS.readFile(ymlPath, 'utf-8');
    return YAML.parse(rawYaml) as Kind;
}

/**
 * Get the embedded attachment from the kapeta.yml file
 */
export async function getEmbeddedConfig(filename: string, baseDir: string = process.cwd()): Promise<Attachment | null> {
    const kapetaYML = await readKapetaYML(baseDir);
    return getAttachment(kapetaYML, filename);
}

/**
 * Write the Kapeta environment variables to a .env file and write any defined config files
 *
 * This will look for a kapeta.config.yml file in the base directory and use it to render the config files
 *
 * It will also look for a kapeta.config.env file in the base directory and use it to render the .env file
 *
 */
export async function writeConfig(baseDir: string = process.cwd()) {
    const kapetaVariables = await resolveKapetaVariables(baseDir);
    await writeDotEnvFile(kapetaVariables, baseDir);
    await writeConfigTemplates(kapetaVariables, baseDir);
}

/**
 * Run a command with the resolved Kapeta environment variables
 */
export async function runWithConfig(
    cmd: string,
    args: string[] = [],
    baseDir: string = process.cwd()
): Promise<ReturnType<typeof spawn>> {
    const kapetaVariables = await resolveKapetaVariables(baseDir);
    return spawn(cmd, args, {
        env: {
            ...kapetaVariables,
            ...process.env,
        },
        stdio: 'pipe',
        shell: true,
    });
}
