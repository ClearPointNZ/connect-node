function Logger(configuration) {
	let json = {};
	let logger = {};

	if (!configuration.appName) {
		return;
	}

	json.appName = configuration.appName;

	function trace(message, payload) {
		printLog('REST', message, payload);
	}

	logger.trace = trace;

	function debug(message, payload) {
		printLog('DEBUG', message, payload);
	}

	logger.debug = debug;

	function info(message, payload) {
		printLog('INFO', message, payload);
	}

	logger.info = info;

	function warn(message, payload) {
		printLog('WARN', message, payload);
	}

	logger.warn = warn;

	function error(message, payload) {
		printLog('ERROR', message, payload);
	}

	logger.error = error;

	function printLog(priority, message, payload) {
		if (!message) {
			return;
		}

		delete json.payload;
		json.priority = priority;
		json.message = message;

		if (payload) {
			json.payload = `${JSON.stringify(payload)}`;
		}
		if (priority !== 'ERROR') {
			console.log(JSON.stringify(json));
		} else {
			console.error(JSON.stringify(json));
		}
	}

	return logger;
}

module.exports.createLogger = function createLogger(configuration) {
	return new Logger(configuration);
};