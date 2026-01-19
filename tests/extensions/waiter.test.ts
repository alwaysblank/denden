import Hub from "../../src/hub";
import {ERRORS, first, latest} from "../../extensions/waiter";
jest.useFakeTimers();

describe('first', () => {
    it('should return data in the correct form', () => {
        const hub = new Hub();
        const subcb = jest.fn();
        expect.assertions(5);
        first(hub, ['test', 'sandwich'], -1, (results) => {
            expect(results).toContainEqual(['test', 'value'] );
            expect(results).toContainEqual(['sandwich', 'reuben']);
        });
        first(hub, ['test', 'sandwich']).then((results) => {
            expect(results).toContainEqual(['test', 'value'] );
            expect(results).toContainEqual(['sandwich', 'reuben']);
        })
        hub.sub('*', subcb);
        hub.pub('test', 'value');
        hub.pub('sandwich', 'reuben');
        expect(subcb).toHaveBeenCalledTimes(2);
    });

    it('should return early if a function times out', () => {
        const hub = new Hub();
        expect.assertions(6);
        first(hub, ['test', 'sandwich'], 10, (results) => {
            expect(results).toContainEqual(
                ['test', 'value']
            );
            expect(results.length).toBe(1);
            expect(results.failed).toContainEqual(['sandwich', ERRORS.TIMED_OUT_SINGLE]);
        });
        first(hub, ['test', 'sandwich'], 10).then((results) => {
            expect(results).toContainEqual(
                ['test', 'value']
            );
            expect(results.length).toBe(1);
            expect(results.failed).toContainEqual(['sandwich', ERRORS.TIMED_OUT_SINGLE]);
        })
        hub.pub('test', 'value');
        jest.advanceTimersByTime(50);
        hub.pub('sandwich', 'reuben');
    }, 60);

    it('should return only the first message in a channel', () => {
        const hub = new Hub();
        const subcb = jest.fn();
        expect.assertions(8);
        first(hub, ['test', 'sandwich'], -1, (results) => {
            expect(results).toContainEqual(['test', 'value'] );
            expect(results).toContainEqual(['sandwich', 'reuben']);
        });
        first(hub, ['test', 'sandwich']).then((results) => {
            expect(results).toContainEqual(['test', 'value'] );
            expect(results).toContainEqual(['sandwich', 'reuben']);
        })
        hub.sub('*', subcb);
        hub.pub('test', 'value');
        hub.pub('sandwich', 'reuben');
        hub.pub('sandwich', 'club');

        expect(subcb).toHaveBeenCalledTimes(3);
        expect(subcb).toHaveBeenCalledWith('value', expect.anything(), expect.anything());
        expect(subcb).toHaveBeenCalledWith('reuben', expect.anything(), expect.anything());
        expect(subcb).toHaveBeenCalledWith('club', expect.anything(), expect.anything());
    });
});

describe('latest', () => {
    it('should return the most recent result', () => {
        const hub = new Hub();
        const subcb = jest.fn();
        expect.assertions(8);
        latest(hub, ['test', 'sandwich'], -1, (results) => {
            expect(results).toContainEqual(['test', 'value'] );
            expect(results).toContainEqual(['sandwich', 'club']);
        });
        latest(hub, ['test', 'sandwich']).then(results => {
            expect(results).toContainEqual(['test', 'value'] );
            expect(results).toContainEqual(['sandwich', 'club']);
        })
        hub.sub('*', subcb);
        hub.pub('sandwich', 'reuben');
        hub.pub('sandwich', 'club');
        hub.pub('test', 'value');

        expect(subcb).toHaveBeenCalledTimes(3);
        expect(subcb).toHaveBeenCalledWith('value', expect.anything(), expect.anything());
        expect(subcb).toHaveBeenCalledWith('reuben', expect.anything(), expect.anything());
        expect(subcb).toHaveBeenCalledWith('club', expect.anything(), expect.anything());
    });


    describe('should reject routes if...', () => {
        it('a route never fires', () => {
            const hub = new Hub();
            const subcb = jest.fn();
            expect.assertions(10);
            latest(hub, ['test', 'sandwich', 'uncalled'], 0, (results) => {
                expect(results).toContainEqual(['test', 'value'] );
                expect(results).toContainEqual(['sandwich', 'club']);
                expect(results.failed).toContainEqual(['uncalled', ERRORS.TIMED_OUT_SINGLE]);
            });
            latest(hub, ['test', 'sandwich', 'uncalled'], 0).then(results => {
                expect(results).toContainEqual(['test', 'value'] );
                expect(results).toContainEqual(['sandwich', 'club']);
                expect(results.failed).toContainEqual(['uncalled', ERRORS.TIMED_OUT_SINGLE]);
            })
            hub.sub('*', subcb);
            hub.pub('sandwich', 'reuben');
            hub.pub('sandwich', 'club');
            hub.pub('test', 'value');
            jest.advanceTimersByTime(10);

            expect(subcb).toHaveBeenCalledTimes(3);
            expect(subcb).toHaveBeenCalledWith('value', expect.anything(), expect.anything());
            expect(subcb).toHaveBeenCalledWith('reuben', expect.anything(), expect.anything());
            expect(subcb).toHaveBeenCalledWith('club', expect.anything(), expect.anything());
        }, 15);

        it('a route fires too late', () => {
            const hub = new Hub();
            const subcb = jest.fn();
            expect.assertions(10);
            latest(hub, ['test', 'sandwich', 'late'], 0, (results) => {
                expect(results).toContainEqual(['test', 'value'] );
                expect(results).toContainEqual(['sandwich', 'club']);
                expect(results.failed).toContainEqual(['late', ERRORS.TIMED_OUT_SINGLE]);
            });
            latest(hub, ['test', 'sandwich', 'late'], 0).then(results => {
                expect(results).toContainEqual(['test', 'value'] );
                expect(results).toContainEqual(['sandwich', 'club']);
                expect(results.failed).toContainEqual(['late', ERRORS.TIMED_OUT_SINGLE]);
            })
            hub.sub('*', subcb);
            hub.pub('sandwich', 'reuben');
            hub.pub('sandwich', 'club');
            hub.pub('test', 'value');
            jest.advanceTimersByTime(10);
            hub.pub('late', 'late value');

            expect(subcb).toHaveBeenCalledTimes(4);
            expect(subcb).toHaveBeenCalledWith('value', expect.anything(), expect.anything());
            expect(subcb).toHaveBeenCalledWith('reuben', expect.anything(), expect.anything());
            expect(subcb).toHaveBeenCalledWith('club', expect.anything(), expect.anything());
        }, 60);

        it('all routes time out', () => {
            const hub = new Hub();
            const subcb = jest.fn();
            expect.assertions(10);

            latest(hub, ['test', 'sandwich'], 0, (results) => {
                expect(results.length).toBe(0);
                expect(results.failed?.length).toBe(1);
                expect(results.failed).toStrictEqual([
                    ['*', ERRORS.TIMED_OUT_ALL],
                ]);
            });
            latest(hub, ['test', 'sandwich'], 0).then(results => {
                expect(results.length).toBe(0);
                expect(results.failed?.length).toBe(1);
                expect(results.failed).toStrictEqual([
                    ['*', ERRORS.TIMED_OUT_ALL],
                ]);
            })

            hub.sub('*', subcb);

            jest.advanceTimersByTime(10);

            hub.pub('sandwich', 'reuben');
            hub.pub('sandwich', 'club');
            hub.pub('test', 'value');

            expect(subcb).toHaveBeenCalledTimes(3);
            expect(subcb).toHaveBeenCalledWith('value', expect.anything(), expect.anything());
            expect(subcb).toHaveBeenCalledWith('reuben', expect.anything(), expect.anything());
            expect(subcb).toHaveBeenCalledWith('club', expect.anything(), expect.anything());
        }, 15);
    });
});