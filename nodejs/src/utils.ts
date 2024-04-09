import Path from 'path';
import FS from 'node:fs/promises';
import {resolveKapetaVariables, Variables, VariableType} from './variable-resolver';
import {writeConfigTemplates} from './config-resolver';
import {spawn} from '@kapeta/nodejs-process';
import {DOTENV_FILE, writeDotEnvFile, writeEnvConfigFile} from './dotenv-interpolation';

import YAML from 'yaml';
import {Attachment, Kind} from '@kapeta/schemas';
import {getAttachment, readAttachmentContent} from './attachments';
import zlib from 'node:zlib';
import util from 'node:util';
import * as os from "os";
import Config from "@kapeta/sdk-config";

const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);

export const MAX_ENV_LENGTH = 256;
export const KAPETA_CONFIG_ENV_VAR = 'KAPETA_CONFIG_PATH';
export const KAPETA_YML = 'kapeta.yml';

// We read environment variables from a json file to avoid argument length limits since some of
// these might be quite long
export const KAPETA_ENV_CONFIG_FILE = 'kapeta.env.config.json';

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
export async function getAttachmentFromKapetaYML(
    filename: string,
    baseDir: string = process.cwd()
): Promise<Attachment | null> {
    const kapetaYML = await readKapetaYML(baseDir);
    return getAttachment(kapetaYML, filename);
}

/**
 * Read the content of a config file. If the file does not exist, it will look for an embedded attachment
 * in the kapeta.yml file
 *
 * Returns the parsed content of the file or null if the file does not exist
 */
export async function readConfigContent(filename: string, baseDir: string = process.cwd()): Promise<string | null> {
    const configPath = Path.join(baseDir, filename);
    try {
        await FS.access(configPath, FS.constants.F_OK);
    } catch (e) {
        const embeddedConfig = await getAttachmentFromKapetaYML(filename, baseDir);
        if (embeddedConfig) {
            const content = await readAttachmentContent(embeddedConfig.content.format, embeddedConfig.content.value);
            return content.toString();
        }
        return null;
    }
    return await FS.readFile(configPath, 'utf-8');
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


export async function getEnvironmentVariables(kapetaVariables:Variables): Promise<Record<string, string>> {
    const env: Record<string, string> = {};
    for (const key in kapetaVariables) {
        const variable = kapetaVariables[key];

        if (variable.type !== VariableType.MAPPED &&
            variable.value.length > MAX_ENV_LENGTH)  {
            // Skip large values except if they are specifically mapped
            continue;
        }
        env[key] = kapetaVariables[key].value;
    }
    return env;
}

export function getConfigFilePath(instanceId: string): string {
    return Path.join(os.tmpdir(), instanceId, KAPETA_ENV_CONFIG_FILE);
}
/**
 * Run a command with the resolved Kapeta environment variables
 */
export async function runWithConfig(
    cmd: string,
    args: string[] = [],
    baseDir: string = process.cwd()
): Promise<ReturnType<typeof spawn>> {
    const config = await Config.init(baseDir);
    const kapetaVariables = await resolveKapetaVariables(baseDir, config);

    const configFilePath = getConfigFilePath(config.getInstanceId());

    // Write the config to a file - will be read by the SDKs
    await writeEnvConfigFile(kapetaVariables, configFilePath);

    const env:NodeJS.ProcessEnv = {
        ...process.env,
        ...await getEnvironmentVariables(kapetaVariables),
        [KAPETA_CONFIG_ENV_VAR]: configFilePath,
    };

    return spawn(cmd, args, {
        env,
        stdio: 'pipe',
        shell: true,
    });
}

export async function unpack(value: string): Promise<Buffer> {
    const gzipped = Buffer.from(value, 'base64');
    return await gunzip(gzipped, {
        level: zlib.constants.Z_BEST_COMPRESSION,
    });
}

export async function pack(content: Buffer): Promise<string> {
    const gzipped = await gzip(content, {
        level: zlib.constants.Z_BEST_COMPRESSION,
    });
    return gzipped.toString('base64');
}
