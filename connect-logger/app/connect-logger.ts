import * as _ from 'lodash';

enum Style {
	PRETTY, PRETTY_JSON, JSON
}

function discoverStyle() {
	const configuredStyle = process.env.CONNECT_LOG_STYLE || 'json';

	console.error('style is ', configuredStyle);

	if (configuredStyle === 'pretty') {
		return Style.PRETTY;
	} else if (configuredStyle === 'pretty-json') {
		return Style.PRETTY_JSON;
	}

	return Style.JSON;
}

interface Excluded {
	[index: string]: string;
}

// store as a map for fast retrieval
const style : Style = discoverStyle();

function discoverExcluded(parse: string) {
	const levels: Excluded = {};

	parse.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter((s) => s.length > 0)
		.forEach((s) => levels[s] = s);

	return levels;
}

const excludedLevels : Excluded = discoverExcluded((process.env.CONNECT_LOG_EXCLUDES || ''));
const excludedPaths : Excluded = discoverExcluded((process.env.CONNECT_LOG_PATHS || ''));

export interface LoggerAugmenter {
	// returns false if we should skip logging this line
	(logBody: any) : boolean;
}

export class ConnectLogger {
	private ctx : any;
	private path: string;

	private static loggerAumentors : LoggerAugmenter[] = [];

	private constructor(path: string) {
		this.path = path;
		this.ctx = null;
	}

	public static createLogger(path: string = 'root') {
		return new ConnectLogger(path || 'root');
	}

	public static registerAugmenter(augmenter : LoggerAugmenter) {
		this.loggerAumentors.push(augmenter);
	}

	public context(newctx : any) : ConnectLogger {
		if (newctx == null) {
			this.ctx = null;
		} else {
			_.merge(this.ctx, newctx);
		}

		return this;
	}

	public level(lvl : string, message : string, ...params: any[]) {
		const level = (lvl || 'trace').toLowerCase();

		if (excludedLevels[level] || excludedPaths[this.path]) {
			return;
		}

		let pos = 0;
		const whole = [];
		if (!params) {
			whole.push(message || '');
		} else {
			(message || '').split('{}').forEach((part) => {
				whole.push(part);

				if (params && params[0] && pos < params[0].length) {
					whole.push(params[0][pos].toString());
				}

				pos = pos + 1;
			});
		}

		const logBody = {'@timestamp': new Date().toISOString(), 'message': whole.join(''), level: level.toUpperCase(), path: this.path};
		_.merge(logBody, this.ctx);

		for (const augmentor of ConnectLogger.loggerAumentors) {
			if (!augmentor(logBody)) {
				return;
			}
		}

		if (style === Style.JSON) {
			console.log(JSON.stringify(logBody));
		} else if (style === Style.PRETTY_JSON) {
			console.log(JSON.stringify(logBody, null, 2));
		} else {
			// make a shallow copy of the fields other than the ones we are printing out
			const copy = {};
			for (const k of Object.keys(logBody)) {
				if (k !== 'level' && k !== '@timestamp' && k !== 'path' && k !== 'message') {
					copy[k] = logBody[k];
				}
			}
			if (Object.keys(copy).length > 0) {
				console.log(logBody.level.padEnd(6), logBody['@timestamp'], '[' + logBody.path + ']', logBody.message, JSON.stringify(copy));
			} else {
				console.log(logBody.level.padEnd(6), logBody['@timestamp'], '[' + logBody.path + ']', logBody.message);
			}
		}
	}

	public trace(message : string, ...params: any[]) {
		this.level('trace', message, params);
	}

	public rest(message : string, ...params: any[]) {
		this.level('rest', message, params);
	}

	public debug(message : string, ...params: any[]) {
		this.level('debug', message, params);
	}

	public info(message : string, ...params: any[]) {
		this.level('info', message, params);
	}

	public warn(message : string, ...params: any[]) {
		this.level('warn', message, params);
	}

	public error(message : string, ...params: any[]) {
		this.level('error', message, params);
	}
}
