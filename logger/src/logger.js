function Logger(configuration) {
    let json = {};
    let logger = {};

    if (!configuration.appName) {
        return;
    }

    json.appName = configuration.appName;

    function log(priority, message, payload) {
        if (typeof priority !== 'string') {
            throw new TypeError('priority must be string');
        }
        printLog(priority, message, payload);
    }

    logger.log = log;

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
        if (!priority) {
            priority = 'REST';
        }

        if (!message) {
            return;
        }

        delete json.payload;
        json.priority = priority;

        if (typeof message === 'object') {
            json.message = `${JSON.stringify(message)}`;
        } else {
            json.message = message;
        }

        if (payload) {
            if (typeof payload === 'object') {
                json.payload = `${JSON.stringify(payload)}`;
            } else {
                json.payload = payload;
            }
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