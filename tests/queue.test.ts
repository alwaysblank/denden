import {Hub} from '../src/hub';
import {queue} from '../src/queue';
import {expect} from "@jest/globals";
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
        const cb = jest.fn();
        queue(hub, cb,[
            ['test', 'value'],
            ['sandwich', 'reuben'],
        ]);
        expect(cb).toHaveBeenCalledTimes(2);
        expect(cb).toHaveBeenNthCalledWith(1, hub, ['test', 'value']);
        expect(cb).toHaveBeenNthCalledWith(2, hub, ['sandwich', 'reuben']);
    });

    it('should ignore invalid items in queue', () => {
        expect.assertions(3);
        const hub = new Hub();
        const cb = jest.fn();
        queue(hub, cb,[
            // @ts-expect-error -- Intended to be wrong; we are testing runtime behave not governed by TypeScript.
            [1],
            ['test', 'value'],
            ['sandwich', 'reuben'],
            // @ts-expect-error -- Intended to be wrong; we are testing runtime behave not governed by TypeScript.
            ['test', 'value', 'channel'],
        ]);
        expect(cb).toHaveBeenCalledTimes(2);
        expect(cb).toHaveBeenNthCalledWith(1, hub, ['test', 'value']);
        expect(cb).toHaveBeenNthCalledWith(2, hub, ['sandwich', 'reuben']);
    });

    it('should contain all initial load message', () => {
        const hub = new Hub();
        const q = queue(hub, jest.fn(), [
            ['test', 'value'],
            ['sandwich', 'reuben'],
        ]);
        expect(q).toStrictEqual([
            ['test', 'value'],
            ['sandwich', 'reuben'],
        ]);
    });
});

describe('Additional Records', () => {
    it('should dispatch for items added after initialization', () => {
        const hub = new Hub();
        const cb = jest.fn();
        const q = queue(hub, cb, []);
        expect(cb).toHaveBeenCalledTimes(0);
        q.push(['sandwich', 'reuben']);
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(hub, ['sandwich', 'reuben']);
        q[3] = ['sandwich', 'club'];
        expect(cb).toHaveBeenCalledTimes(2);
        expect(cb).toHaveBeenCalledWith(hub, ['sandwich', 'club']);
    });

    it('should ignore pushes which are invalid records', () => {
        const hub = new Hub();
        const cb = jest.fn();
        const q = queue(hub, cb, []);
        expect(cb).toHaveBeenCalledTimes(0);
        // @ts-expect-error -- We're testing intentionally invalid values, since this can be called client-side where TS won't apply.
        q.push('sandwich');
        expect(cb).toHaveBeenCalledTimes(0);
        // @ts-expect-error -- We're testing intentionally invalid values, since this can be called client-side where TS won't apply.
        q.push([3, 'value'])
        expect(cb).toHaveBeenCalledTimes(0);
        expect(q).toStrictEqual([
            'sandwich',
            [3, 'value'],
        ]);
    });
})