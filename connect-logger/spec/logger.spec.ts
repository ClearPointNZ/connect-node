
process.env.CONNECT_LOG_EXCLUDES = 'sausage';
process.env.CONNECT_LOG_PATHS = 'cumberlands';

import {ConnectLogger} from '../app/connect-logger';
import { expect } from 'chai';
import 'mocha';

describe('json logging works as expected', () => {

	let realConsole;
	let logs;

	beforeEach(() => {
		realConsole = console.log;
		logs = [];
		console.log = (...p: any[]) => {
			logs.push(p);
		};
	});

	afterEach(() => {
		console.log = realConsole;
	});

	it('should log a basic json log', () => {
		const logger = ConnectLogger.createLogger('sample');
		logger.info('this is not ${} but is seven {}', 5, 'dollars');
		expect(logs.length, 'count of logs').to.equal(1);
		const log = JSON.parse(logs[0][0]);
		expect(log).to.not.equal(null);
		expect(log.message).to.equal('this is not $5 but is seven dollars');
		expect(log.priority).to.equal('INFO');
		expect(log.path).to.equal('sample');
	});

	it('should allow me to add a push context', () => {
		const logger = ConnectLogger.createLogger('sample');
		logger.context({beef: 1}).info('hello').push({sausage: 'mine'}).debug('there').pop().warn('amigo');
		expect(logs.length, 'count of logs').to.equal(3);
		console.error(logs);
		const log1 = JSON.parse(logs[0][0]);
		expect(log1.message).to.equal('hello');
		expect(log1.beef).to.equal(1);
		expect(log1.sausage).to.be.undefined;
		expect(log1.priority).to.equal('INFO');
		const log2 = JSON.parse(logs[1][0]);
		expect(log2.message).to.equal('there');
		expect(log2.beef).to.equal(1);
		expect(log2.sausage).to.equal('mine');
		expect(log1.priority).to.equal('INFO');

		expect(JSON.parse(logs[2][0]).sausage).to.be.undefined;
	});

	it('should be able to cope with undefined and null', () => {
		const logger = ConnectLogger.createLogger('sample');
		logger.debug('a field {} {} {}')
			.log('undefined {}', undefined)
			.log('null {}', null)
			.log('',null,null)
			.log(null);
		console.error('exceptional: ', logs);
	});

	it('should exclude cumberlands path from the logs', () => {
		const sample = ConnectLogger.createLogger('sample');
		const sausage = ConnectLogger.createLogger('cumberlands');
		sample.info('help');
		sausage.info('help');
		expect(logs.length).to.equal(1);
		const log = JSON.parse(logs[0][0]);
		expect(log.path).to.equal('sample');
	});

	it('should exclude the sausage priority from the logs', () => {
		const sample = ConnectLogger.createLogger('sample');
		ConnectLogger.registerAugmenter((logBody) => {
			logBody['snookum-killer'] = 'here';
			return logBody['priority'] !== 'SNOOKUMS';
		});
		sample.info('info');
		sample.priority('sausage', 'info');
		sample.priority('snookums', 'info');
		sample.priority('pookums', 'info');
		console.error('logs are: ', logs);
		expect(logs.length).to.equal(2);
		expect(logs[0][0]).to.contain('INFO');
		expect(logs[1][0]).to.contain('POOKUMS');
		expect(logs[1][0]).to.contain('snookum-killer');
	});

	it('should log a stack trace', () => {
		const sample = ConnectLogger.createLogger('sample');
		sample.info('info', new Error('torpid the eel'));
		console.error(logs);
		const log = JSON.parse(logs[0][0]);
		expect(log.stack_trace).to.contain('torpid');
		expect(log.message).to.contain(' (Error torpid the eel)');
		console.error('st logs are:', logs );
	});
});
