import Path from 'path';
import FS from 'node:fs/promises';
import { resolveKapetaVariables } from './variable-resolver';
import { writeConfigTemplates } from './config-resolver';
import { spawn } from '@kapeta/nodejs-process';
import { writeDotEnvFile } from './dotenv-interpolation';

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
