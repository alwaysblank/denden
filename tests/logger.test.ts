import {log} from '../src/logger';

type ConsoleInput = [string, {level: string}];
let consoleOutput: ConsoleInput[] = [];
const mockedLog = (...inputs: ConsoleInput) => consoleOutput.push(inputs);
beforeEach(() => {
	consoleOutput = [];
})

afterEach(() => {
	jest.restoreAllMocks();
});

describe('log levels', () => {
	it('should handle FATAL logs', () => {
		global.console.error = jest.fn(mockedLog);
		log('FATAL', 'fatal message', {level: 'fatal'});
		expect(consoleOutput.length).toBe(1);
		expect(consoleOutput[0]).toStrictEqual(['💣 FATAL ERROR: fatal message', {level: 'fatal'}]);
	});
	it('should handle ERROR logs', () => {
		global.console.error = jest.fn(mockedLog);
		log('ERROR', 'error message', {level: 'error'});
		expect(consoleOutput.length).toBe(1);
		expect(consoleOutput[0]).toStrictEqual(['error message', {level: 'error'}]);
	});
	it('should handle WARN logs', () => {
		global.console.warn = jest.fn(mockedLog);
		log('WARN', 'warn message', {level: 'warn'});
		expect(consoleOutput.length).toBe(1);
		expect(consoleOutput[0]).toStrictEqual(['warn message', {level: 'warn'}]);
	});
	it('should handle INFO logs', () => {
		global.console.info = jest.fn(mockedLog);
		log('INFO', 'info message', {level: 'info'});
		expect(consoleOutput.length).toBe(1);
		expect(consoleOutput[0]).toStrictEqual(['info message', {level: 'info'}]);
	});
	it('should handle DEBUG logs', () => {
		global.console.debug = jest.fn(mockedLog);
		log('DEBUG', 'debug message', {level: 'debug'});
		expect(consoleOutput.length).toBe(1);
		expect(consoleOutput[0]).toStrictEqual(['debug message', {level: 'debug'}]);
	});
});