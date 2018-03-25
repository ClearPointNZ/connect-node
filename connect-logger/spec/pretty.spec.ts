
// process.env.CONNECT_LOG_STYLE = 'pretty-json';
//
// import {ConnectLogger} from '../app/connect-logger';
// import { expect } from 'chai';
// import 'mocha';
//
// describe('pretty-json logging works as expected', () => {
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
// 	it('should use pretty json logging', () => {
// 		const logger = ConnectLogger.createLogger('sample');
// 		logger.info('this is not ${} but is seven {}', 5, 'dollars');
// 		expect(logs.length, 'count of logs').to.equal(1);
// 		expect(logs[0][0]).to.contain('\n');
// 	});
// });
