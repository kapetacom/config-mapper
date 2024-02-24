import FS from 'node:fs/promises';

export type ConfigFileTemplates = {
    [path: string]: string;
}

export type ConfigData = {
    [key: string]: string|number|boolean;
}

export class ConfigFileWriter {
    private readonly templates: ConfigFileTemplates;

    constructor(templates:ConfigFileTemplates) {
        this.templates = templates;
    }

    public render(data:ConfigData) {
        const rendered: {[path:string]: string} = {};
        for(const path in this.templates) {
            rendered[path] = this.renderTemplate(path, data);
        }
        return rendered;
    }

    public async write(data:ConfigData) {
        const rendered = this.render(data);
        const entries = Object.entries(rendered);
        for(const [path, value] of entries) {
            console.log(`Writing to ${path}`);
            await FS.writeFile(path, value);
        }
    }

    public renderTemplate(path:string, data:ConfigData):string {
        if (!(path in this.templates)) {
            throw new Error(`Template not found: ${path}`);
        }

        const template = this.templates[path];

        return template.replace(/\${([^}]+)}/g, (match, key) => {
            if (!(key in data)) {
                throw new Error(`Data not found for key: ${key}`);
            }
            return data[key].toString();
        });

    }
}