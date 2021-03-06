/**
 * loads config from multiple locations into loadedProperties and allows injection into objects and class
 * instances annotated with configKey.
 */

import * as minimist from 'minimist';
import * as jsYaml from 'js-yaml';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as chokidar from 'chokidar';
import {ParsedArgs} from 'minimist';
import 'reflect-metadata';
import {ConnectLogger} from 'connect-logger-core';

let loadedProperties;

export interface ConfigurationPropertyInitializer {
	// process the config
	process(configLoader: ConfigurationLoader, props: any) : Promise<void>;
}

export interface IndexedObject {
	[index: string]: any;
}

const logger = ConnectLogger.createLogger('connect-config-loader');

export function configKey(key: string, required: boolean = false) {
	function configKeyDecorator(target: any, property: string | symbol): void {
		if (!target['__configKeys__']) {
			target['__configKeys__'] = [];
		}
		target['__configKeys__'].push(new ConfigKeyConfig(key, required, property));
	}

	// return the decorator
	return configKeyDecorator;
}

class ConfigKeyConfig {
	constructor(private key: string, private required: boolean, private property: string | symbol) {
	}

	public getKey() {
		return this.key;
	}

	public isRequired() {
		return this.required;
	}

	public getProperty() {
		return this.property;
	}

	public toString() {
		return this.property.toString();
	}
}

const postProcessors: ConfigurationPropertyInitializer[] = [];

export class ConfigurationLoader {

	private propertyFiles: string[];

	private objects: IndexedObject[] = [];

	protected static getConnectConfig(): ParsedArgs {
		return minimist(process.env.CONNECT_CONFIG ?
			process.env.CONNECT_CONFIG.split(' ') :
			process.argv.slice(2));
	}

	public async load() : Promise<void> {
		loadedProperties = {};

		const args = ConfigurationLoader.getConnectConfig();

		if (args['p']) {
			// minimist supports multiple copies of a param
			this.propertyFiles = typeof args['p'] === 'string' ? [args['p']] : args['p'];

			setTimeout(() => {
				// watch file changes and rewire
				chokidar.watch(this.propertyFiles, {ignoreInitial: true}).on('all', () => {
					loadedProperties = {};
					this.loadProperties();
				});
			}, 0);

			await this.loadProperties();
		}
	}

	public get(key : string, defaultValue: any = null) : any {
		const result = _.get(loadedProperties, key);

		return (result == null) ? defaultValue : result;
	}

	public static registerInitializer(cpp: ConfigurationPropertyInitializer) {
		postProcessors.push(cpp);
		logger.info('registering initializer {}', postProcessors);
	}

	private async loadProperties() : Promise<void> {
		logger.info('loading from {}', process.cwd());

		for (const propertyFile of this.propertyFiles) {
			try {
				logger.info('loading file `{}`', propertyFile);
				const additionalProperties = jsYaml.safeLoad(fs.readFileSync(propertyFile, 'utf8'));
				_.merge(loadedProperties, additionalProperties);
			} catch (e) {
				logger.error('Error loading property file {}', propertyFile, e);
			}
		}

		ConfigurationLoader.loadEnvironmentVariables();

		const initializers : Promise<void>[] = [];

		logger.info('post processor count: {}', postProcessors);
		postProcessors.forEach((cpp) => {
			initializers.push(cpp.process(this, loadedProperties));
		});

		await Promise.all(initializers);

		this.objects.forEach((obj) => {
			this.pushProperties(obj);
		});
	}

	public static setConfigBase(fullObject: IndexedObject, indexKey: string) {
		fullObject['_configIndex'] = indexKey;
	}

	public static setConfig(fullObject: IndexedObject, property: string, key: string, required: boolean = false) {
		configKey(key, required)(fullObject, property);
	}

	private pushProperties(fullObject: IndexedObject) {
		let objectKeys: ConfigKeyConfig[] = fullObject['__configKeys__'];

		if (!objectKeys) {
			objectKeys = ConfigurationLoader.pretendConfig(Object.keys(fullObject), fullObject['_configIndex']);
		}

		for (const prop of objectKeys) {
			const property = prop.getProperty().toString();
			const pathOfConfiguration = prop.getKey();
			const required = prop.isRequired();

			const val = _.get(loadedProperties, pathOfConfiguration);

			if (val) {
				fullObject[property] = val;
			} else if (required) {
				logger.error('field `{}`, key `{}` does not have a value.', property, pathOfConfiguration);
				throw new Error('field ' + property + ' key ' + pathOfConfiguration + ' does not have a value.');
			}
		}

		// see if there is a post configured function to call and call it.
		if (fullObject['postConfigured']) {
			fullObject['postConfigured'](); // assume this is a function.
		}
	}

	private static pretendConfig(properties: string[], baseOffset: string): ConfigKeyConfig[] {
		const config: ConfigKeyConfig[] = [];

		for (const property of properties) {
			if (property !== '_configIndex') {
				const key = baseOffset ? baseOffset + '.' + property : property;
				config.push(new ConfigKeyConfig(key, false, property));
			}
		}

		return config;
	}

	public setProperties(fullObject: IndexedObject) {
		this.objects.push(fullObject);
		this.pushProperties(fullObject);
	}

	private static loadEnvironmentVariables() {
		const env = {};

		for (const key of Object.keys(process.env)) {
			env[key] = process.env[key];
		}

		loadedProperties.env = env;
	}
}

export const configurationLoader = new ConfigurationLoader();
