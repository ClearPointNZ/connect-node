
// process.env.CONNECT_LOG_EXCLUDES = 'sausage';
// process.env.CONNECT_LOG_PATHS = 'cumberlands';
//
// import {ConnectLogger} from '../app/connect-logger';
// import { expect } from 'chai';
// import 'mocha';
//
// describe('json logging works as expected', () => {
//
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
// 	it('should log a basic json log', () => {
// 		const logger = ConnectLogger.createLogger('sample');
// 		logger.info('this is not ${} but is seven {}', 5, 'dollars');
// 		expect(logs.length, 'count of logs').to.equal(1);
// 		const log = JSON.parse(logs[0][0]);
// 		expect(log).to.not.equal(null);
// 		expect(log.message).to.equal('this is not $5 but is seven dollars');
// 		expect(log.level).to.equal('INFO');
// 		expect(log.path).to.equal('sample');
// 	});
//
// 	it('should exclude cumberlands path from the logs', () => {
// 		const sample = ConnectLogger.createLogger('sample');
// 		const sausage = ConnectLogger.createLogger('cumberlands');
// 		sample.info('help');
// 		sausage.info('help');
// 		expect(logs.length).to.equal(1);
// 		const log = JSON.parse(logs[0][0]);
// 		expect(log.path).to.equal('sample');
// 	});
//
// 	it('should exclude the sausage level from the logs', () => {
// 		const sample = ConnectLogger.createLogger('sample');
// 		ConnectLogger.registerAugmenter((logBody) => {
// 			logBody['snookum-killer'] = 'here';
// 			return logBody['level'] !== 'SNOOKUMS';
// 		});
// 		sample.info('info');
// 		sample.level('sausage', 'info');
// 		sample.level('snookums', 'info');
// 		sample.level('pookums', 'info');
// 		console.error('logs are: ', logs);
// 		expect(logs.length).to.equal(2);
// 		expect(logs[0][0]).to.contain('INFO');
// 		expect(logs[1][0]).to.contain('POOKUMS');
// 		expect(logs[1][0]).to.contain('snookum-killer');
// 	});
// });
