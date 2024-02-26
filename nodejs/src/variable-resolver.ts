/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

import dotenv from 'dotenv';
import { BlockDefinition, Plan, Resource } from '@kapeta/schemas';
import Config, {ConfigProvider, InstanceOperator, LocalConfigProvider, ResourceInfo} from '@kapeta/sdk-config';
import ClusterConfiguration, { DefinitionInfo, Definition } from '@kapeta/local-cluster-config';
import { parseKapetaUri, KapetaURI } from '@kapeta/nodejs-utils';
import { explodeEnvVars, toEnvVarName } from './environment';
import { interpolateDotEnv } from './dotenv-interpolation';
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

    public async resolve(): Promise<AnyMap> {
        const envVars: AnyMap<string> = {
            [KAPETA_SYSTEM_ID]: this.configProvider.getSystemId(),
            [KAPETA_BLOCK_REF]: this.configProvider.getBlockReference(),
            [KAPETA_INSTANCE_ID]: this.configProvider.getInstanceId(),
            [KAPETA_PROVIDER_HOST]: await this.configProvider.getServerHost(),
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

        envVars['KAPETA_INSTANCE_CONFIG'] = JSON.stringify(this.getConfiguration());
        const exploded = explodeEnvVars(envVars);
        const mappedVars = await this.resolveMappings(exploded as AnyMap<string>);

        return explodeEnvVars(mappedVars);
    }

    private async resolveMappings(envVars: AnyMap<string>) {
        const dotEnvRaw = await readConfigContent(KAPETA_DOTENV_FILE, this.baseDir);
        if (!dotEnvRaw) {
            return envVars;
        }

        const parsed = dotenv.parse(dotEnvRaw);
        return interpolateDotEnv(parsed, envVars);
    }

    private async resolveForInstances() {
        const out: AnyMap<string> = {};
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
        out['KAPETA_BLOCK_HOSTS'] = JSON.stringify(blockHosts);
        return out;
    }

    private async resolveForInstanceId(instanceId: string) {
        const out: AnyMap<string> = {};

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

        if (blockProvider.definition.kind === BLOCK_TYPE_OPERATOR) {
            try {
                let instance:InstanceOperator<any, any>|null;
                if (this.configProvider instanceof LocalConfigProvider) {
                    instance = await this.configProvider.getInstanceOperator(instanceId, false);
                } else {
                    instance = await this.configProvider.getInstanceOperator(instanceId);
                }

                if (instance) {
                    out[`KAPETA_INSTANCE_OPERATOR_${toEnvVarName(instanceId)}`] = JSON.stringify(instance);
                }
            } catch (e) {
                // Ignore
            }
        }

        return out;
    }

    private async resolveForConsumer(consumer: Resource) {
        const out: AnyMap<string> = {};
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
                out[`KAPETA_CONSUMER_SERVICE_${toEnvVarName(name)}_${toEnvVarName(portType)}`] = serviceAddress;
            }

            try {
                const instance = await this.configProvider.getInstanceForConsumer(name);
                if (instance) {
                    out[`KAPETA_INSTANCE_FOR_CONSUMER_${toEnvVarName(name)}`] = JSON.stringify(instance);
                }
            } catch (e) {
                // Ignore
            }
        }

        if (RESOURCE_TYPE_OPERATOR === resourceType.definition.kind) {
            let resourceInfo:ResourceInfo<any, any>|null;
            if (this.configProvider instanceof LocalConfigProvider) {
                resourceInfo = await this.configProvider.getResourceInfo(kindUri.fullName, portType, name, false);
            } else {
                resourceInfo = await this.configProvider.getResourceInfo(kindUri.fullName, portType, name);
            }
            if (resourceInfo) {
                out[`KAPETA_CONSUMER_RESOURCE_${toEnvVarName(name)}_${toEnvVarName(portType)}`] =
                    JSON.stringify(resourceInfo);
            }
        }

        return out;
    }

    private async resolveForProvider(provider: Resource) {
        const out: AnyMap<string> = {};
        const kindUri = parseKapetaUri(provider.kind);
        const resourceType = this.getDefinition(kindUri);
        if (!resourceType) {
            return out;
        }

        const portType = provider.spec.port.type;
        const name = provider.metadata.name;

        if (HOST_PORT_TYPES.includes(portType.toLowerCase())) {
            out[`KAPETA_PROVIDER_PORT_${portType.toUpperCase()}`] = await this.configProvider.getServerPort(portType);
        }

        const instances = await this.configProvider.getInstancesForProvider(name);
        if (instances) {
            out[`KAPETA_INSTANCES_FOR_PROVIDER_${toEnvVarName(name)}`] = JSON.stringify(instances);
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
): Promise<AnyMap> {
    if (!configProvider) {
        configProvider = await Config.init(baseDir);
    }
    const resolver = new KapetaVariableResolver(configProvider, baseDir);

    return resolver.resolve();
}
