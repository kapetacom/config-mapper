import Path from 'path';
import FS from 'node:fs/promises';
import { resolveKapetaVariables } from './variable-resolver';
import { writeConfigTemplates } from './config-resolver';
import { spawn } from '@kapeta/nodejs-process';

export const DOTENV_FILE = '.env';

export async function writeConfig(baseDir: string = process.cwd()) {
    const kapetaVariables = await resolveKapetaVariables(baseDir);
    let dotEnv = '';
    Object.entries(kapetaVariables).forEach(([key, value]) => {
        dotEnv += `${key}=${JSON.stringify(value)}\n`;
    });
    const dotEnvPath = Path.join(baseDir, DOTENV_FILE);
    console.log('Writing environment variables to %s', DOTENV_FILE);
    await FS.writeFile(dotEnvPath, dotEnv);

    await writeConfigTemplates(kapetaVariables, baseDir);
}

export async function runWithConfig(cmd: string, args: string[] = [], baseDir: string = process.cwd()): Promise<ReturnType<typeof spawn>> {
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
