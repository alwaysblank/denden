import Hub from "../src/hub";
import {ERRORS, waitFor, waitForDebounced} from "../extensions/waiter";
jest.useFakeTimers();

describe('waitFor', () => {
    it('should return data in the correct form', (done) => {
        const hub = new Hub();
        const subcb = jest.fn();
        expect.assertions(3);
        waitFor(hub, ['test', 'sandwich'], (results) => {
            expect(results).toContainEqual(['test', 'value'] );
            expect(results).toContainEqual(['sandwich', 'reuben']);
            done();
        });
        hub.sub('*', subcb);
        hub.pub('test', 'value');
        hub.pub('sandwich', 'reuben');
        expect(subcb).toHaveBeenCalledTimes(2);
    });

    it('should return early if a function times out', (done) => {
        const hub = new Hub();
        expect.assertions(3);
        waitFor(hub, ['test', 'sandwich'], (results) => {
            expect(results).toContainEqual(
                ['test', 'value']
            );
            expect(results.length).toBe(1);
            expect(results.failed).toContainEqual(['sandwich', 'sandwich timed out.']);
            done();
        }, 10);
        hub.pub('test', 'value');
        jest.advanceTimersByTime(50);
        hub.pub('sandwich', 'reuben');
    }, 60);

    it('should return only the first message in a channel', (done) => {
        const hub = new Hub();
        const subcb = jest.fn();
        expect.assertions(6);
        waitFor(hub, ['test', 'sandwich'], (results) => {
            expect(results).toContainEqual(['test', 'value'] );
            expect(results).toContainEqual(['sandwich', 'reuben']);
            done();
        });
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

describe('waitForDebounced', () => {
    it('should return the most recent result', (done) => {
        const hub = new Hub();
        const subcb = jest.fn();
        expect.assertions(6);
        waitForDebounced(hub, ['test', 'sandwich'], (results) => {
            expect(results).toContainEqual(['test', 'value'] );
            expect(results).toContainEqual(['sandwich', 'club']);
            done();
        });
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
        it('a route never fires', (done) => {
            const hub = new Hub();
            const subcb = jest.fn();
            expect.assertions(7);
            waitForDebounced(hub, ['test', 'sandwich', 'uncalled'], (results) => {
                expect(results).toContainEqual(['test', 'value'] );
                expect(results).toContainEqual(['sandwich', 'club']);
                expect(results.failed).toContainEqual(['uncalled', ERRORS.TIMED_OUT_SINGLE]);
                done();
            }, 0);
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

        it('a route fires too late', (done) => {
            const hub = new Hub();
            const subcb = jest.fn();
            expect.assertions(7);
            waitForDebounced(hub, ['test', 'sandwich', 'late'], (results) => {
                expect(results).toContainEqual(['test', 'value'] );
                expect(results).toContainEqual(['sandwich', 'club']);
                expect(results.failed).toContainEqual(['late', ERRORS.TIMED_OUT_SINGLE]);
                done();
            }, 0);
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

        it('all routes time out', (done) => {
            const hub = new Hub();
            const subcb = jest.fn();
            expect.assertions(7);

            waitForDebounced(hub, ['test', 'sandwich'], (results) => {
                expect(results.length).toBe(0);
                expect(results.failed?.length).toBe(2);
                expect(results.failed).toStrictEqual([
                    ['test', ERRORS.TIMED_OUT_SINGLE],
                    ['sandwich', ERRORS.TIMED_OUT_SINGLE],
                ]);
                done();
            }, 0);

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
})