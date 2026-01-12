import {Hub} from '../src/hub';
import {makeQueue} from '../src/queue';
import {describe, expect} from '@jest/globals';
jest.mock("../src/hub", () => {
	return {
		__esModule: true,
		...jest.requireActual("../src/hub"),
		Hub: jest.fn().mockImplementation(() => ({
			sub: jest.fn(),
			pub: jest.fn(),
		})),
	}
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('First Run', () => {
    it('should call queued items in order', () => {
        expect.assertions(3);
        const hub = new Hub();
        makeQueue(hub, [
            ['test', 'value'],
            ['sandwich', 'reuben'],
        ]);
        expect(hub.pub).toHaveBeenCalledTimes(2);
        expect(hub.pub).toHaveBeenNthCalledWith(1, 'test', 'value');
        expect(hub.pub).toHaveBeenNthCalledWith(2, 'sandwich', 'reuben');
    });

    it('should ignore invalid items in queue', () => {
        expect.assertions(3);
        const hub = new Hub();
        makeQueue(hub, [
            // @ts-expect-error -- Intended to be wrong; we are testing runtime behavior not governed by TypeScript.
            [1],
            ['test', 'value'],
            ['sandwich', 'reuben'],
            // @ts-expect-error -- Intended to be wrong; we are testing runtime behave not governed by TypeScript.
            ['test', 'value', 'channel'],
        ]);
		expect(hub.pub).toHaveBeenCalledTimes(2);
		expect(hub.pub).toHaveBeenNthCalledWith(1, 'test', 'value');
		expect(hub.pub).toHaveBeenNthCalledWith(2, 'sandwich', 'reuben');
    });

    it('should contain all initial load message', () => {
        const hub = new Hub();
        const q = makeQueue(hub, [
            ['test', 'value'],
            ['sandwich', 'reuben'],
        ]);
        expect(q).toStrictEqual([
            ['test', 'value'],
            ['sandwich', 'reuben'],
        ]);
    });
});

describe('Record Types', () => {
	it('should handle messages', () => {
		const hub = new Hub();
		const q = makeQueue(hub, [
			['test', 'value'],
			['sandwich', 'reuben'],
		]);
		expect(hub.pub).toHaveBeenCalledTimes(2);
		expect(hub.pub).toHaveBeenNthCalledWith(1, 'test', 'value');
		expect(hub.pub).toHaveBeenNthCalledWith(2, 'sandwich', 'reuben');
		q.push(['sandwich', 'club']);
		expect(hub.pub).toHaveBeenCalledTimes(3);
		expect(hub.pub).toHaveBeenNthCalledWith(3, 'sandwich', 'club');
	});

	it('should handle commands', () => {
		const hub = new Hub();
		const cb1 = jest.fn()
		const cb2 = jest.fn();
		const cb3 = jest.fn();
		const q = makeQueue(hub, [cb1, cb2]);
		expect(cb1).toHaveBeenCalledTimes(1);
		expect(cb1).toHaveBeenCalledWith(hub);
		expect(cb2).toHaveBeenCalledTimes(1);
		expect(cb2).toHaveBeenCalledWith(hub);
		expect(cb3).toHaveBeenCalledTimes(0);
		q.push(cb3);
		expect(cb3).toHaveBeenCalledTimes(1);
		expect(cb3).toHaveBeenCalledWith(hub);
	});

	it('should handle a mix of record types', () => {
		const hub = new Hub();
		const cb1 = jest.fn()
		const cb2 = jest.fn();
		const q = makeQueue(hub, [
			['test', 'value'],
			cb1,
		]);
		expect(hub.pub).toHaveBeenCalledTimes(1);
		expect(hub.pub).toHaveBeenNthCalledWith(1, 'test', 'value');
		expect(cb1).toHaveBeenCalledTimes(1);
		expect(cb1).toHaveBeenCalledWith(hub);
		q.push(['sandwich', 'club']);
		expect(hub.pub).toHaveBeenCalledTimes(2);
		expect(hub.pub).toHaveBeenNthCalledWith(2, 'sandwich', 'club');
		q.push(cb2);
		expect(cb2).toHaveBeenCalledTimes(1);
		expect(cb2).toHaveBeenCalledWith(hub);
	})
});

describe('Additional Records', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	})
    it('should dispatch for items added after initialization', () => {
        const hub = new Hub();
        const q = makeQueue(hub, []);
        expect(hub.pub).toHaveBeenCalledTimes(0);
        q.push(['sandwich', 'reuben']);
        expect(hub.pub).toHaveBeenCalledWith('sandwich', 'reuben');
        q[3] = ['sandwich', 'club'];
        expect(hub.pub).toHaveBeenCalledWith('sandwich', 'club');
    });

    it('should ignore pushes which are invalid records', () => {
		console.error = jest.fn();
        const hub = new Hub();
        const q = makeQueue(hub, []);
        expect(hub.pub).toHaveBeenCalledTimes(0);
        // @ts-expect-error -- We're testing intentionally invalid values, since this can be called client-side where TS won't apply.
        q.push('sandwich');
		expect(console.error).toHaveBeenCalledWith('Queues only accept records of type QueuedMessage or QueuedCommand');
        expect(hub.pub).toHaveBeenCalledTimes(0);
        // @ts-expect-error -- We're testing intentionally invalid values, since this can be called client-side where TS won't apply.
        q.push([3, 'value'])
		expect(console.error).toHaveBeenCalledWith('Queues only accept records of type QueuedMessage or QueuedCommand');
        expect(hub.pub).toHaveBeenCalledTimes(0);
        expect(q).toStrictEqual([
            'sandwich',
            [3, 'value'],
        ]);
    });
})