
import { ConfigurationLoader, configKey } from '../app/config-loader';
import { expect } from 'chai';
import 'mocha';


class Booya {
	@configKey('yourobject.value_d')
	fred : number;

	setFred(f : number) {
		this.fred = f;
	}

	getFred() {
		return this.fred;
	}
}

describe('loader tests', () => {

	it('should load the objects from environment', () => {
		process.env.CONNECT_CONFIG = '-p spec/test1.yml';

		const configurationLoader = new ConfigurationLoader();
		configurationLoader.load();

		let obj1 = {value_s1: '',
			value_s2: '',
			value_s3: '',
			value_s4: '',
			value_i: ''};

		configurationLoader.setConfigBase(obj1, 'myobject');

		configurationLoader.setProperties(obj1);

		console.log('obje', obj1);

		expect(obj1.value_i).to.equal(3);
		expect(obj1.value_s1).to.equal('one');
		expect(obj1.value_s2).to.equal('two');
		expect(obj1.value_s3).to.equal('');
	});

	it('should load objects from params and typescript', () => {
		process.argv = ['-pspec/test1.yml'];
		const configurationLoader = new ConfigurationLoader();
		configurationLoader.load();

		let b = new Booya();
		configurationLoader.setProperties(b);

		expect(b.fred).to.equal(18.0);
	});
	
	it('should allow us to configure arbitrary js objects', () => {
		process.env.CONNECT_CONFIG = '-p spec/test1.yml';

		const configurationLoader = new ConfigurationLoader();
		configurationLoader.load();

		let obj1 = {value_s1: '',
			value_s2: '',
			value_s3: '',
			value_d: '',
			value_i: ''};

		configurationLoader.setConfig(obj1, 'value_s1', 'myobject.value_s1');
		configurationLoader.setConfig(obj1, 'value_s2', 'myobject.value_s2');
		configurationLoader.setConfig(obj1, 'value_i', 'myobject.value_i');
		configurationLoader.setConfig(obj1, 'value_d', 'yourobject.value_d');

		configurationLoader.setProperties(obj1);
		
		expect(obj1.value_i).to.equal(3);
		expect(obj1.value_s1).to.equal('one');
		expect(obj1.value_s2).to.equal('two');
		expect(obj1.value_d).to.equal(18.0);

	});
});