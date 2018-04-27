//
// process.env.CONNECT_LOG_STYLE = 'pretty';
//
// import {ConnectLogger} from '../app/connect-logger';
// import { expect } from 'chai';
// import 'mocha';
//
// describe('pretty logging works as expected', () => {
// 	let realConsole;
// 	let logs;
//
// 	beforeEach(() => {
// 		realConsole = console.log;
// 		logs = [];
// 		console.log = (...p: any[]) => {
// 			logs.push(p);
// 		};
// 	});
//
// 	afterEach(() => {
// 		console.log = realConsole;
// 	});
//
// 	it('should use pretty logging', () => {
// 		const logger = ConnectLogger.createLogger('sample');
// 		logger.info('this is not ${} but is seven {}', 5, 'dollars');
// 		console.error('pretty: ', logs[0]);
// 		expect(logs.length, 'count of logs').to.equal(1);
// 		expect(logs[0].length).to.equal(4);
// 		expect(logs[0][3]).to.equal('this is not $5 but is seven dollars');
// 		expect(logs[0][2]).to.equal('[sample]');
// 		// expect(logs[0][0]).to.contain('\n');
// 	});
//
// 	it('should multi-line stack traces', () => {
// 		const logger = ConnectLogger.createLogger('sample');
// 		logger.priority('wibble', 'message', 1, new Error('hum dinger'));
// 		expect(logs.length).to.equal(2);
// 		expect(logs[1][0]).to.contain('hum');
// 	});
// });
