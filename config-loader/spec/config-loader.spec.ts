/**
 * basic tests suite
 */

import {ConfigurationLoader, configKey, ConfigurationPropertyInitializer} from '../app/config-loader';
import { expect } from 'chai';
import 'mocha';
import * as _ from 'lodash';

import {ConnectLogger} from 'connect-logger-core';

class Booya {
	@configKey('yourobject.value_d')
	public fred : number;
}

class Hooya {
	@configKey('simple')
	public simple : string;
	@configKey('duplicate.simple')
	public simple2 : string;
}

const logger = ConnectLogger.createLogger('config-loader-spec');

class SimpleInitializer implements ConfigurationPropertyInitializer {
	public async process(cl : ConfigurationLoader, loadedProperties: any) : Promise<void> {
		const value = _.get(loadedProperties, 'simple');

		if (value) {
			_.set(loadedProperties, 'simple',  value.toString() + 'x');
			_.set(loadedProperties, 'duplicate.simple', value);
			logger.info('loaded properties: ', loadedProperties);
		}
	}
}

describe('loader tests', () => {

	it('should load the objects from environment', async () => {
		process.env.CONNECT_CONFIG = '-p spec/test1.yml';

		const configurationLoader = new ConfigurationLoader();
		await configurationLoader.load();

		const obj1 = {value_s1: '',
			value_s2: '',
			value_s3: '',
			value_s4: '',
			value_i: ''};

		ConfigurationLoader.setConfigBase(obj1, 'myobject');

		configurationLoader.setProperties(obj1);

		expect(obj1.value_i).to.equal(3);
		expect(obj1.value_s1).to.equal('one');
		expect(obj1.value_s2).to.equal('two');
		expect(obj1.value_s3).to.equal('');
	});

	it('should support get straight out of config', async () => {
		process.env.CONNECT_CONFIG = '-p spec/test1.yml';

		const configurationLoader = new ConfigurationLoader();
		await configurationLoader.load();

		expect(configurationLoader.get('yourobject.value_d')).to.equal(18.0);
		expect(configurationLoader.get('meep.von.icecream', 'vanilla')).to.equal('vanilla');
	});

	it('should load objects from params and typescript', async () => {
		process.argv = ['-pspec/test1.yml'];
		const configurationLoader = new ConfigurationLoader();
		await configurationLoader.load();

		const b = new Booya();
		configurationLoader.setProperties(b);

		expect(b.fred).to.equal(18.0);
	});

	it('should allow us to configure arbitrary js objects', async () => {
		process.env.CONNECT_CONFIG = '-p spec/test1.yml';

		const configurationLoader = new ConfigurationLoader();
		await configurationLoader.load();

		const obj1 = {value_s1: '',
			value_s2: '',
			value_s3: '',
			value_d: '',
			value_i: '',
		  value_env: ''};

		ConfigurationLoader.setConfig(obj1, 'value_s1', 'myobject.value_s1');
		ConfigurationLoader.setConfig(obj1, 'value_s2', 'myobject.value_s2');
		ConfigurationLoader.setConfig(obj1, 'value_i', 'myobject.value_i');
		ConfigurationLoader.setConfig(obj1, 'value_d', 'yourobject.value_d');
		ConfigurationLoader.setConfig(obj1, 'value_env', 'env.CONNECT_CONFIG');

		configurationLoader.setProperties(obj1);

		expect(obj1.value_i).to.equal(3);
		expect(obj1.value_s1).to.equal('one');
		expect(obj1.value_s2).to.equal('two');
		expect(obj1.value_d).to.equal(18.0);
		expect(obj1.value_env).to.equal('-p spec/test1.yml');

	});

	it('should support multiple post processors', async () => {
		ConfigurationLoader.registerInitializer(new SimpleInitializer());
		process.env.CONNECT_CONFIG = '-p spec/test2.yml';
		const configurationLoader = new ConfigurationLoader();
		await configurationLoader.load();

		const h = new Hooya();
		configurationLoader.setProperties(h);
		expect(h.simple).to.equal('sausagex');
		expect(h.simple2).to.equal('sausage');
	});
});
