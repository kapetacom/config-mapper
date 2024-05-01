/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

import { BlockDefinition, Plan, Resource } from '@kapeta/schemas';
import Config, { ConfigProvider, InstanceOperator, LocalConfigProvider, ResourceInfo } from '@kapeta/sdk-config';
import ClusterConfiguration, { DefinitionInfo, Definition } from '@kapeta/local-cluster-config';
import { parseKapetaUri, KapetaURI } from '@kapeta/nodejs-utils';
import { explodeEnvVars, toEnvVarName } from './environment';
import { readDotEnv } from './dotenv-interpolation';
import { readConfigContent } from './utils';

// The core types we're particularly interested in. TODO: These should be defined elsewhere.
export const RESOURCE_TYPE_INTERNAL = 'core/resource-type-internal';
export const RESOURCE_TYPE_OPERATOR = 'core/resource-type-operator';
export const BLOCK_TYPE_OPERATOR = 'core/block-type-operator';

// The types of ports we support as a host type. TODO: This should be defined elsewhere.
export const HOST_PORT_TYPES = ['rest', 'grpc', 'http', 'web'];

// A few standard Kapeta environment variables. TODO: These should be defined elsewhere.
export const KAPETA_SYSTEM_TYPE = 'KAPETA_SYSTEM_TYPE';
export const KAPETA_SYSTEM_ID = 'KAPETA_SYSTEM_ID';
export const KAPETA_BLOCK_REF = 'KAPETA_BLOCK_REF';
export const KAPETA_INSTANCE_ID = 'KAPETA_INSTANCE_ID';
export const KAPETA_PROVIDER_HOST = 'KAPETA_PROVIDER_HOST';

/**
 * The name of the dotenv configuration file
 */
export const KAPETA_DOTENV_FILE = 'kapeta.config.env';

type AnyMap<T = any> = { [key: string]: T };

const uriMapper = (p: DefinitionInfo) => {
    const uri = parseKapetaUri(p.definition.metadata.name + ':' + p.version);
    return {
        uri,
        definition: p.definition,
    };
};

export enum VariableType {
    ENV,
    EXPLODED,
    MAPPED,
}

export type VariableInfo = {
    type: VariableType;
    value: string;
    json?: boolean;
};
export type Variables = Record<string, VariableInfo>;

export function toEnvVars(value: { [key: string]: string }): Variables {
    const out: Variables = {};
    Object.entries(value).forEach(([key, value]) => {
        out[key] = toEnvVar(value);
    });
    return out;
}

export function toEnvVar(value: string, json = false): VariableInfo {
    return {
        type: VariableType.ENV,
        value,
        json,
    };
}

export function toExplodedVar(value: string): VariableInfo {
    return {
        type: VariableType.EXPLODED,
        value,
    };
}

export function toMappedVar(value: string): VariableInfo {
    return {
        type: VariableType.MAPPED,
        value,
    };
}

/**
 * Resolves Kapeta variables for a given block
 *
 * The variables are basically environment variables that are used to configure the block,
 * but they are also used for creating configuration files
 */
export class KapetaVariableResolver {
    private readonly configProvider: ConfigProvider;
    private readonly definitions: { definition: Definition; uri: KapetaURI }[];
    private readonly block: BlockDefinition;
    private readonly plan: Plan;
    private readonly baseDir: string;

    constructor(configProvider: ConfigProvider, baseDir: string) {
        this.configProvider = configProvider;
        this.definitions = ClusterConfiguration.getDefinitions().map(uriMapper);
        this.block = this.configProvider.getBlockDefinition() as BlockDefinition;
        this.baseDir = baseDir;

        const planUri = parseKapetaUri(this.configProvider.getSystemId());
        const planDefinition = this.getDefinition(planUri);
        if (!planDefinition) {
            throw new Error(`Plan not found: ${this.configProvider.getSystemId()}`);
        }

        this.plan = planDefinition.definition as Plan;
    }

    private getDefinition(uri: KapetaURI) {
        return this.definitions.find((p) => p.uri.equals(uri));
    }

    private getConfiguration() {
        const config: AnyMap = {};
        this.block.spec.configuration?.types?.forEach((configItem) => {
            config[configItem.name] = this.configProvider.get(configItem.name);
        });

        return config;
    }

    public async resolve(): Promise<Variables> {
        const envVars: Variables = {
            [KAPETA_SYSTEM_ID]: toEnvVar(this.configProvider.getSystemId()),
            [KAPETA_BLOCK_REF]: toEnvVar(this.configProvider.getBlockReference()),
            [KAPETA_INSTANCE_ID]: toEnvVar(this.configProvider.getInstanceId()),
            [KAPETA_PROVIDER_HOST]: toEnvVar(await this.configProvider.getServerHost()),
        };

        if (this.block.spec?.providers) {
            for (const provider of this.block.spec?.providers) {
                Object.assign(envVars, await this.resolveForProvider(provider));
            }
        }

        if (this.block.spec?.consumers) {
            for (const consumer of this.block.spec.consumers) {
                Object.assign(envVars, await this.resolveForConsumer(consumer));
            }
        }

        Object.assign(envVars, await this.resolveForInstances());

        envVars['KAPETA_INSTANCE_CONFIG'] = toEnvVar(JSON.stringify(this.getConfiguration()), true);
        const exploded = explodeEnvVars(envVars);
        const mappedVars = await this.resolveMappings(exploded);

        return explodeEnvVars(mappedVars);
    }

    private async resolveMappings(envVars: Variables) {
        const dotEnvRaw = await readConfigContent(KAPETA_DOTENV_FILE, this.baseDir);
        if (!dotEnvRaw) {
            return envVars;
        }

        return readDotEnv(dotEnvRaw, envVars);
    }

    private async resolveForInstances() {
        const out: Variables = {};
        const instanceIds =
            this.plan.spec?.blocks?.map((block) => {
                return block.id;
            }) ?? [];
        const blockHosts: AnyMap<string> = {};
        for (const instanceId of instanceIds) {
            const host = await this.configProvider.getInstanceHost(instanceId);
            if (host) {
                blockHosts[instanceId] = host;
            }
            Object.assign(out, await this.resolveForInstanceId(instanceId));
        }
        out['KAPETA_BLOCK_HOSTS'] = toEnvVar(JSON.stringify(blockHosts), true);
        return out;
    }

    private async resolveForInstanceId(instanceId: string) {
        const out: Variables = {};

        const blockInstance = this.plan.spec?.blocks?.find((block) => block.id === instanceId);
        if (!blockInstance) {
            return out; //Should not happen
        }

        const blockUri = parseKapetaUri(blockInstance.block.ref);

        const blockDefinition = this.getDefinition(blockUri);
        if (!blockDefinition) {
            throw new Error(`Block not found: ${blockInstance.block.ref}`);
        }

        const blockDefinitionUri = parseKapetaUri(blockDefinition.definition.kind);

        const blockProvider = this.getDefinition(blockDefinitionUri);

        if (!blockProvider) {
            throw new Error(`Block provider not found: ${blockDefinition.definition.kind}`);
        }

        if (blockProvider.definition.kind === BLOCK_TYPE_OPERATOR && blockProvider.definition.spec.local) {
            try {
                let instance: InstanceOperator<any, any> | null;
                if (this.configProvider instanceof LocalConfigProvider) {
                    instance = await this.configProvider.getInstanceOperator(instanceId, false);
                } else {
                    instance = await this.configProvider.getInstanceOperator(instanceId);
                }

                if (instance) {
                    out[`KAPETA_INSTANCE_OPERATOR_${toEnvVarName(instanceId)}`] = toEnvVar(
                        JSON.stringify(instance),
                        true
                    );
                }
            } catch (e) {
                // Ignore
            }
        }

        return out;
    }

    private async resolveForConsumer(consumer: Resource) {
        const out: Variables = {};
        const portType = consumer.spec?.port?.type;
        const name = consumer.metadata.name;
        const kindUri = parseKapetaUri(consumer.kind);

        const resourceType = this.getDefinition(kindUri);
        if (!resourceType) {
            return out;
        }

        if (RESOURCE_TYPE_INTERNAL === resourceType.definition.kind) {
            const serviceAddress = await this.configProvider.getServiceAddress(name, portType);
            if (serviceAddress) {
                out[`KAPETA_CONSUMER_SERVICE_${toEnvVarName(name)}_${toEnvVarName(portType)}`] =
                    toEnvVar(serviceAddress);
            }

            try {
                const instance = await this.configProvider.getInstanceForConsumer(name);
                if (instance) {
                    out[`KAPETA_INSTANCE_FOR_CONSUMER_${toEnvVarName(name)}`] = toEnvVar(
                        JSON.stringify(instance),
                        true
                    );
                }
            } catch (e) {
                // Ignore
            }
        }

        if (RESOURCE_TYPE_OPERATOR === resourceType.definition.kind && resourceType.definition.spec.local) {
            // Only get resource info if provider has a local definition
            let resourceInfo: ResourceInfo<any, any> | null;
            if (this.configProvider instanceof LocalConfigProvider) {
                resourceInfo = await this.configProvider.getResourceInfo(kindUri.fullName, portType, name, false);
            } else {
                resourceInfo = await this.configProvider.getResourceInfo(kindUri.fullName, portType, name);
            }
            if (resourceInfo) {
                out[`KAPETA_CONSUMER_RESOURCE_${toEnvVarName(name)}_${toEnvVarName(portType)}`] = toEnvVar(
                    JSON.stringify(resourceInfo),
                    true
                );
            }
        }

        return out;
    }

    private async resolveForProvider(provider: Resource) {
        const out: Variables = {};
        const kindUri = parseKapetaUri(provider.kind);
        const resourceType = this.getDefinition(kindUri);
        if (!resourceType) {
            return out;
        }

        const portType = provider.spec.port.type;
        const name = provider.metadata.name;

        if (HOST_PORT_TYPES.includes(portType.toLowerCase())) {
            out[`KAPETA_PROVIDER_PORT_${portType.toUpperCase()}`] = toEnvVar(
                await this.configProvider.getServerPort(portType)
            );
        }

        const instances = await this.configProvider.getInstancesForProvider(name);
        if (instances) {
            out[`KAPETA_INSTANCES_FOR_PROVIDER_${toEnvVarName(name)}`] = toEnvVar(JSON.stringify(instances), true);
        }

        return out;
    }
}

/**
 * Resolves Kapeta variables for a given block - expected to be in "baseDir".
 */
export async function resolveKapetaVariables(
    baseDir: string = process.cwd(),
    configProvider?: ConfigProvider
): Promise<Variables> {
    if (!configProvider) {
        configProvider = await Config.init(baseDir);
    }
    const resolver = new KapetaVariableResolver(configProvider, baseDir);

    return resolver.resolve();
}
