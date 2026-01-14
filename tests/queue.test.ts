import Hub from "../src/hub";
import Queue from "../src/queue";
jest.mock("../src/hub", () => {
    return jest.fn().mockImplementation(() => ({
            send: jest.fn(),
            pub: jest.fn(),
    }))
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('First Run', () => {
    it('should dispatch to all channels in initial load', () => {
        const hub = new Hub();
        const q = Queue([
            ['test', 'value'],
            ['sandwich', 'reuben'],
        ], hub);
        expect(hub.pub).toHaveBeenCalledTimes(2);
        expect(hub.pub).toHaveBeenCalledWith('test', 'value');
        expect(hub.pub).toHaveBeenCalledWith('sandwich', 'reuben');
    });

    it('should contain all initial load message', () => {
        const hub = new Hub();
        const q = Queue([
            ['test', 'value'],
            ['sandwich', 'reuben'],
        ], hub);
        expect(q).toStrictEqual([
            ['test', 'value'],
            ['sandwich', 'reuben'],
        ]);
    });
});

describe('Additional Records', () => {
    it('should dispatch for items added after initialization', () => {
        const hub = new Hub();
        const q = Queue([], hub);
        expect(hub.pub).toHaveBeenCalledTimes(0);
        q.push(['sandwich', 'reuben']);
        expect(hub.pub).toHaveBeenCalledTimes(1);
        expect(hub.pub).toHaveBeenCalledWith('sandwich', 'reuben');
        q[3] = ['sandwich', 'club'];
        expect(hub.pub).toHaveBeenCalledTimes(2);
        expect(hub.pub).toHaveBeenCalledWith('sandwich', 'club');
    });

    it('should ignore pushes which are invalid records', () => {
        const hub = new Hub();
        const q = Queue([], hub);
        expect(hub.pub).toHaveBeenCalledTimes(0);
        // @ts-expect-error -- We're testing intentionally invalid values, since this can be called client-side where TS won't apply.
        q.push('sandwich');
        expect(hub.pub).toHaveBeenCalledTimes(0);
        // @ts-expect-error -- We're testing intentionally invalid values, since this can be called client-side where TS won't apply.
        q.push([3, 'value'])
        expect(hub.pub).toHaveBeenCalledTimes(0);
        expect(q).toStrictEqual([
            'sandwich',
            [3, 'value'],
        ]);
    });
})