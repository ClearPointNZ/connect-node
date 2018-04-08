
import {ConfigurationLoader, ConfigurationPropertyInitializer} from 'connect-config-loader';
import * as fs from 'fs';
import * as rp from 'request-promise-native';
import * as vault from 'node-vault';
import * as _ from 'lodash';
import {ConnectLogger} from 'connect-logger-core';

interface SubPropertyMap {
	[key: string]: string;
}

const VAULT_KEY_PREFIX : string = '[K8SVAULT]';

const logger = ConnectLogger.createLogger('connect.vault-initializer');

class VaultKey {
	// I'm with Steve Yegge on this one
	public systemPropertyFieldName : string;
	public vaultKeyName : string;
	public treatAsMap : boolean;
	public subPropertyFieldNames : SubPropertyMap = {};

	constructor(systemPropertyFieldName: string, vaultKeyName: string, treatAsMap: boolean) {
		this.systemPropertyFieldName = systemPropertyFieldName;
		this.vaultKeyName = this.split(vaultKeyName);
		this.treatAsMap = treatAsMap;
	}

	public toString() : string {
		const submap = [];
		Object.keys(this.subPropertyFieldNames).forEach((k) => submap.push(k + '=' + this.subPropertyFieldNames[k]));
		return `key: '${this.systemPropertyFieldName}', vault key: '${this.vaultKeyName}', expect map: '${this.treatAsMap}, sub property map '${submap.join()}'`;
	}

	private split(systemPropertyFieldName : string) : string {
		const parts = systemPropertyFieldName.split('#');

		if (parts.length > 1) {
			parts[1].split(',')
				.map((s: string) => s.trim())
				.filter((s: string) => s.length > 0)
				.forEach((subPart : string) => {
					const mapped = subPart.split(new RegExp('[:=]'));
					if (mapped.length === 2) {
						this.subPropertyFieldNames[mapped[0]] = mapped[1];
					} else {
						this.subPropertyFieldNames[mapped[0]] = mapped[0];
					}
				});
		}

		return parts[0];
	}
}

export class VaultInitializer implements ConfigurationPropertyInitializer {
	private vaultKeys : VaultKey[] = [];
	private vaultUrl : string;
	private configLoader : ConfigurationLoader;

	// this gets called after naked properties have been loaded.
	public async process(configLoader: ConfigurationLoader, loadedProperties: any) {
		this.configLoader = configLoader;

		this.vaultUrl = configLoader.get('vault.url');
		if (this.vaultUrl) {
			this.walkKeys('', loadedProperties);

			if (this.vaultKeys.length > 0) {
				if (process.env.CONNECT_APP_SECRET_ID) {
					await this.configureAppClient(loadedProperties);
				} else {
					await this.configureKubernetesClient(loadedProperties);
				}
			} else {
				logger.info('vault: url configured but no keys.');
			}
		} else {
			logger.debug('vault: not configured, ignoring');
		}
	}

	private static readFile(filename : string) : string {
		return fs.readFileSync(filename, {encoding: 'UTF-8'}).toString();
	}

	private async configureAppClient(props: any) : Promise<void> {
		const roleId = this.configLoader.get('env.CONNECT_APP_ROLE_ID', this.configLoader.get('vault.role_id'));
		if (roleId == null) {
			throw new Error('CONNECT_APP_SECRET_ID specified in environment but no role id found.');
		}

		const vaultCert = VaultInitializer.readFile(this.configLoader.get('env.VAULT_CERTFILE',
			this.configLoader.get('vault.certFile', './vault-ca.crt')));

		logger.info('attempting to connect to Vault using AppRoleLogin.');

		const options = <vault.Option> {
			apiVersion: 'v1',
			endpoint: this.vaultUrl
		};

		const vaultClient = vault(options);
		const authResult = await vaultClient.approleLogin({
			requestOptions: { ca: vaultCert },
			role_id: roleId,
			secret_id: process.env.CONNECT_APP_SECRET_ID
		});

		logger.info('auth result {}', authResult);

		const token = _.get(authResult, 'auth.client_token');

		await this.resolveKeys(token, vaultCert, props);
	}

	private async configureKubernetesClient(props: any) : Promise<void> {
		const vaultJwtTokenFile = this.configLoader.get('env.VAULT_TOKENFILE',
			this.configLoader.get('vault.tokenFile', '/var/run/secrets/kubernetes.io/serviceaccount/token'));
		const vaultCert = VaultInitializer.readFile(this.configLoader.get('env.VAULT_CERTFILE',
			this.configLoader.get('vault.certFile', '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt')));
		const vaultRole = this.configLoader.get('env.VAULT_ROLE',
			this.configLoader.get('vault.role',
				this.configLoader.get('app.name')));
		const vaultRoleUrl = this.configLoader.get('env.VAULT_ROLE_URL',
			this.configLoader.get('vault.role_url', '/v1/auth/kubernetes/login'));

		let vaultJwtToken = this.configLoader.get('env.VAULT_TOKEN');

		if (vaultJwtToken === null) {
			vaultJwtToken = VaultInitializer.readFile(vaultJwtTokenFile).trim();
			if (vaultJwtTokenFile.endsWith('\n')) {
				vaultJwtToken = vaultJwtToken.substring(0, vaultJwtToken.length - 1);
			}
		}

		if (vaultJwtToken == null) {
			throw new Error('No jwt token for vault found and need to resolve keys.');
		}

		const realToken = await this.requestAuthToken(vaultJwtToken, vaultRole, vaultCert, vaultRoleUrl);

		await this.resolveKeys(realToken, vaultCert, props);
	}

	private async resolveKeys(realToken: string, vaultCert: string, props: any) {
		const options = <vault.Option> {
			apiVersion: 'v1',
			endpoint: this.vaultUrl,
			token: realToken
		};

		const requestOptions = <vault.Option> {
			ca: vaultCert
		};

		const vaultClient = vault(options);
		const vaultRequests = [];

		this.vaultKeys.forEach((key) => {
			vaultRequests.push(vaultClient.read(key.vaultKeyName, requestOptions).then((val) => {
				VaultInitializer.fillKey(key, val.data, props);
			}).catch((error) => {
				logger.error('Key `{}` was not available.', key.vaultKeyName, error);
			}
			));
		});

		await Promise.all(vaultRequests);

	}

	private async requestAuthToken(vaultJwtToken: string, vaultRole : string, vaultCa: string, vaultRolePath: string) : Promise<string> {
			const requestJson = {jwt: vaultJwtToken, role: vaultRole};
			const options = {
				url: this.vaultUrl + vaultRolePath,
				ca: vaultCa,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Connectosaur'
				},
				json: true,
				body: requestJson
			};

			try {
				const response = await rp(options);
				logger.info('response from vault for token: {}', response);
				return _.get(response, 'auth.client_token');
			} catch (e) {
				logger.error('fault request failed', e);
				throw e;
			}

	}

	private static nextKey(keybase : string, key : string) : string {
		return keybase.length === 0 ? key : (keybase + '.' + key);
	}

	private walkKeys(keybase: string, props: any) {
		for ( const key of Object.keys(props)) {
			const val = props[key];
			if (val instanceof Object) {
				this.walkKeys(VaultInitializer.nextKey(keybase, key), val);
			} else {
				const str = val.toString();
				if (str.startsWith(VAULT_KEY_PREFIX)) {
					let part = str.substring(VAULT_KEY_PREFIX.length).trim();

					let treatAsMap = false;
					if (part.endsWith('!')) {
						treatAsMap = true;
						part = part.substring(0, part.length - 1);
					}

					this.vaultKeys.push(new VaultKey(VaultInitializer.nextKey(keybase, key), part, treatAsMap));
				}
			}
		}
	}

	private static fillKey(key: VaultKey, val: any, props: any) {
		if (key.treatAsMap) {
			const kvLog = [];
			for (const k of Object.keys(val)) {
				kvLog.push(k + '=*****');
			}
			_.set(props, key.systemPropertyFieldName, val);
			logger.log('`{}` is a map', kvLog.join(','));
		} else if (_.isEmpty(key.subPropertyFieldNames)) {
			const data = val['value'];
			if (data) {
				_.set(props, key.systemPropertyFieldName, data);
				logger.info('set `{}` from vault', key.systemPropertyFieldName);
			} else {
				logger.error("No 'value' found for `{}` at key `{}`", key.systemPropertyFieldName, key.vaultKeyName);
			}
		} else {
			for (const k of Object.keys(key.subPropertyFieldNames)) {
				const data = val[k];
				if (data == null) {
					logger.error('No `{}.{}` found for key `{}`', key.systemPropertyFieldName, k, key.vaultKeyName);
				} else {
					_.set(props, key.systemPropertyFieldName + '.' + k, data);
					logger.info('Set `{}.{} for key `{}`', key.systemPropertyFieldName, k, key.vaultKeyName);
				}
			}
		}
	}
}

console.log('registering vault initializer');
export const vaultInitializer = new VaultInitializer();
ConfigurationLoader.registerInitializer(vaultInitializer);
