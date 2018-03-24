
import '../app/vault-initializer';

import {ConfigurationLoader} from 'connect-config-loader/target/app/config-loader';

describe('vault tests', () => {
	it('should initialize', () => {
		process.env.CONNECT_CONFIG = '-p spec/test2.yml';
		const configurationLoader = new ConfigurationLoader();
		configurationLoader.load();
	});
});
