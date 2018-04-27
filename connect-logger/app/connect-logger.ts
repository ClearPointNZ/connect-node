import * as _ from 'lodash';

enum Style {
	PRETTY, PRETTY_JSON, JSON
}

function discoverStyle() {
	const configuredStyle = process.env.CONNECT_LOG_STYLE || 'json';

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
	const values: Excluded = {};

	parse.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter((s) => s.length > 0)
		.forEach((s) => values[s] = s);

	return values;
}

const excludedPriorities : Excluded = discoverExcluded((process.env.CONNECT_LOG_EXCLUDES || ''));
const excludedPaths : Excluded = discoverExcluded((process.env.CONNECT_LOG_PATHS || ''));

export interface LoggerAugmenter {
	// returns false if we should skip logging this line
	(logBody: any) : boolean;
}

export class ConnectLogger {
	private ctx : any;
	private path: string;
	private pushContexts : any[];

	private static loggerAumentors : LoggerAugmenter[] = [];

	private constructor(path: string) {
		this.path = path;
		this.ctx = {};
		this.pushContexts = [];
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

	public push(newctx : any) : ConnectLogger {
		this.pushContexts.push(newctx);

		return this;
	}

	public pop() : ConnectLogger {
		if (this.pushContexts.length > 0) {
			this.pushContexts.pop();
		}

		return this;
	}



	private isError(e: any) : boolean {
		return e && e.stack && e.message && typeof e.stack === 'string' && typeof e.message === 'string';
	}

	public priority(pri : string, message : string, ...params: any[]) : ConnectLogger {
		const priority = (pri || 'trace').toLowerCase();

		if (excludedPriorities[priority] || excludedPaths[this.path] || message == null || _.isUndefined(message)) {
			return;
		}

		if (!_.isString(message)) {
			try {
				message = (<string>message).toString();
			} catch (e) {
				message = '';
			}
		}

		let pos = 0;
		const logBody = {'@timestamp': new Date().toISOString(), priority: priority.toUpperCase(), path: this.path, message: ''};

		if (!params || params.length === 0) {
			logBody.message = message;
		} else {
			const whole = [];

			(message || '').split('{}').forEach((part) => {
				whole.push(part);

				if (pos < params.length) {
					if (_.isError(params[pos])) {
						whole.push(' (Error ' + params[pos]['message'] + ')');
					} else if (_.isObject(params[pos])) {
						whole.push(JSON.stringify(params[pos]));
					} else if (_.isUndefined(params[pos])) {
						whole.push('<<undefined>>');
					} else if (_.isNull(params[pos])) {
						whole.push('<<null>>');
					} else {
						try {
							whole.push(params[pos].toString());
						} catch (e) {
							whole.push('<<field has no tostring>>');
						}
					}

					pos = pos + 1;
				}
			});

			logBody.message = whole.join('');

			const e = params[params.length - 1];

			if (this.isError(e)) {
				logBody['stack_trace'] = e.message + ':' + e.stack;
			}
		}

		_.merge(logBody, this.ctx);

		if (this.pushContexts.length > 0) {
			this.pushContexts.forEach((pc) => {
				_.merge(logBody, pc);
			});
		}

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
				if (k !== 'priority' && k !== '@timestamp' && k !== 'path' && k !== 'message' && k !== 'stack_trace') {
					copy[k] = logBody[k];
				}
			}
			if (Object.keys(copy).length > 0) {
				console.log(logBody.priority.padEnd(6), logBody['@timestamp'], '[' + logBody.path + ']', logBody.message, JSON.stringify(copy));
			} else {
				console.log(logBody.priority.padEnd(6), logBody['@timestamp'], '[' + logBody.path + ']', logBody.message);
			}

			if (logBody['stack_trace']) {
				console.log(logBody['stack_trace']);
			}
		}

		return this;
	}

	public trace(message : string, ...params: any[]) : ConnectLogger {
		this.priority('trace', message, ...params);
		return this;
	}

	public rest(message : string, ...params: any[]) : ConnectLogger {
		this.priority('rest', message, ...params);
		return this;
	}

	public debug(message : string, ...params: any[]) : ConnectLogger {
		this.priority('debug', message, ...params);
		return this;
	}

	public info(message : string, ...params: any[]) : ConnectLogger {
		this.priority('info', message, ...params);
		return this;
	}

	public warn(message : string, ...params: any[]) : ConnectLogger {
		this.priority('warn', message, ...params);
		return this;
	}

	public error(message : string, ...params: any[]) : ConnectLogger {
		this.priority('error', message, ...params);
		return this;
	}

	public log(message : string, ...params: any[]) : ConnectLogger {
		this.priority('debug', message, ...params);
		return this;
	}
}
