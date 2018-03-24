
import {ConfigurationLoader, ConfigurationPropertyInitializer} from 'connect-config-loader/target/app/config-loader';
import * as fs from 'fs';
import * as rp from 'request-promise-native';
import * as vault from 'node-vault';
import * as _ from 'lodash';

interface SubPropertyMap {
	[key: string]: string;
}

const VAULT_KEY_PREFIX : string = '[K8SVAULT]';

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

		console.log('here', loadedProperties);

		this.vaultUrl = configLoader.get('vault.url');
		if (this.vaultUrl) {
			this.walkKeys('', loadedProperties);

			if (this.vaultKeys.length > 0) {
				console.log('haz keys');
				await this.configureVaultClient(loadedProperties);
			}
		}
	}

	private static readFile(filename : string) : string {
		return fs.readFileSync(filename, {encoding: 'UTF-8'}).toString();
	}

	private async configureVaultClient(props: any) : Promise<void> {
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
			}).catch((error) => console.error(error)));
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
				console.log('response from vault for token: ', response);
				return _.get(response, 'auth.client_token');
			} catch (e) {
				console.error('failed vault', e);
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
		console.log('val from vault is ', val);
		if (key.treatAsMap) {
			const kvLog = [];
			for (const k of Object.keys(val)) {
				kvLog.push(k + '=*****');
			}
			_.set(props, key.systemPropertyFieldName, val);
			console.log(key.systemPropertyFieldName + ' is map:', kvLog.join(','));
		} else if (_.isEmpty(key.subPropertyFieldNames)) {
			const data = val['value'];
			if (data) {
				_.set(props, key.systemPropertyFieldName, data);
				console.log(key.systemPropertyFieldName + ' is set');
			} else {
				console.error('no \'value\' found for ', key.systemPropertyFieldName, ' key', key.vaultKeyName);
			}
		} else {
			for (const k of Object.keys(key.subPropertyFieldNames)) {
				const data = val[k];
				if (data == null) {
					console.error('no \'', key.systemPropertyFieldName + '.' + k, '\' found for key', key.vaultKeyName);
				} else {
					_.set(props, key.systemPropertyFieldName + '.' + k, data);
					console.log('set \'', key.systemPropertyFieldName + '.' + k, '\' for key', key.vaultKeyName);
				}
			}
		}
	}
}

console.log('registering vault initializer');
export const vaultInitializer = new VaultInitializer();
ConfigurationLoader.registerInitializer(vaultInitializer);
