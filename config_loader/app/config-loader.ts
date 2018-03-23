
import * as minimist from 'minimist';
import * as jsYaml from 'js-yaml';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as chokidar from 'chokidar';
import {ParsedArgs} from 'minimist';
import 'reflect-metadata';

let loadedProperties = undefined;

export interface ConfigurationPostProcessor {
	key(key, value: string, loadedProperties: any);
}

export interface IndexedObject { [index: string]: any }

const configKeyMetaData = Symbol('configKey');

class ConfigKeyConfig {
	constructor(private key: string, private required: boolean, private property : string | symbol) {
	}

	getKey() { return this.key; }
	isRequired() { return this.required; }
	getProperty() { return this.property; }
	toString() { return this.property.toString(); }
}



// export function configKey(target : any, key: string, required = false) {
export function configKey(key : string, required: boolean = false) {
	function configKeyDecorator(target: Object, property: string | symbol) : void {
		if (!target['__pros__']) {
			target['__pros__'] = []
		}
		target['__pros__'].push(new ConfigKeyConfig(key, required, property));
	}

	// return the decorator
	return configKeyDecorator;
}

export class ConfigurationLoader {

	private propertyFiles: string[];
	private postProcessors: ConfigurationPostProcessor[] = [];
	private objects: IndexedObject[] = [];

	protected getConnectEnv() : string[] {
		return process.env.CONNECT_CONFIG.split(' ');
	}

	protected getCommandLineArgs() : string[]  {
		return process.argv.slice(2);
	}

	protected getConnectConfig() : ParsedArgs {
		return minimist(process.env.CONNECT_CONFIG ? this.getConnectEnv() : this.getCommandLineArgs());
	}

	public load() {
		loadedProperties = {};

		const args = this.getConnectConfig();

		if (args['p']) {
			// minimist supports multiple copies of a param
			this.propertyFiles = typeof args['p'] === 'string' ? [args['p']] : args['p'];
			this.loadProperties();

			// watch file changes and rewire
			chokidar.watch(this.propertyFiles, {ignoreInitial: true}).on('all', (event, path) => {
				loadedProperties = {};
				this.loadProperties();
			});
		}
	}

	private postProcess(cpp: ConfigurationPostProcessor) {
		Object.keys(loadedProperties).forEach(key => {
			cpp.key(key, loadedProperties[key], loadedProperties);
		});
	}

	public postProcessProperties(cpp: ConfigurationPostProcessor) {
		this.postProcessors.push(cpp);
		this.postProcess(cpp);
	}

	private loadProperties() {
		console.log('loading from ', process.cwd());

		for (const propertyFile of this.propertyFiles) {
			try {
				console.log('loading... ', '`' + propertyFile + '`', fs.realpathSync(propertyFile));
				const additionalProperties = jsYaml.safeLoad(fs.readFileSync(propertyFile, 'utf8'));
				_.merge(loadedProperties, additionalProperties);
			} catch (e) {
				console.error('Error loading property file', propertyFile, e);
			}
		}

		this.postProcessors.forEach(cpp => {
			this.postProcess(cpp);
		});

		this.objects.forEach(obj => {
			this.pushProperties(obj);
		});
	}

	public setConfigBase(fullObject: IndexedObject, indexKey : string) {
		fullObject['_configIndex'] = indexKey;
	}

	public setConfig(fullObject: IndexedObject, property : string, key: string, required : boolean = false ) {
		configKey(key, required)(fullObject, property);
	}

	private pushProperties(fullObject: IndexedObject) {
		let objectKeys : ConfigKeyConfig[] = fullObject['__pros__'];

		if (!objectKeys) {
			objectKeys = this.pretendConfig(Object.keys(fullObject), fullObject['_configIndex']);
		}

		for (const prop of objectKeys) {
			const property = prop.getProperty().toString();
			const pathOfConfiguration = prop.getKey();
			const required = prop.isRequired();


			const val = _.get(loadedProperties, pathOfConfiguration);

			// console.log('property ', property, ' from ', pathOfConfiguration, 'required', required, 'val', val);

			if (val) {
				fullObject[property] = val;
			} else if (required) {
				throw new Error('field ' + property + ' key ' + pathOfConfiguration + ' does not have a value.');
			}
		}
	}

	private pretendConfig(properties: string[], baseOffset: string) : ConfigKeyConfig[] {
		const config: ConfigKeyConfig[] = [];

		for(const property of properties) {
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
}

export const configLoader = new ConfigurationLoader();
configLoader.load();