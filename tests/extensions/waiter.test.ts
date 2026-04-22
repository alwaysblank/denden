import {Hub} from '../../src';
import {
    ERRORS,
    first,
    firstAsync,
    latest,
    latestAsync,
    setExpected as shouldExpect, getSucceeded, getFailed, Results, setExpected, METADATA,
} from '../../src/extensions/waiter';
import {resolveRoute} from "../../src/tools";
jest.useFakeTimers();

describe('first', () => {
    it('should return data in the correct form', () => {
        const hub = new Hub();
        const subcb = jest.fn();
        const assertOnResults = <T>(results: Results<T>) => {
            const passed = getSucceeded(results);
            expect(passed).toHaveLength(2);
            expect(passed).toContainEqual(['test', 'value']);
            expect(passed).toContainEqual(['sandwich', 'reuben']);
        }
        expect.assertions(7);
        first(hub, assertOnResults, ['test', 'sandwich'], -1);
        firstAsync(hub, ['test', 'sandwich'], -1).then(assertOnResults);
        hub.sub('*', subcb);
        hub.pub('test', 'value');
        hub.pub('sandwich', 'reuben');
        expect(subcb).toHaveBeenCalledTimes(2);
    });

    it('should return early if a function times out', () => {
        const hub = new Hub();
        expect.assertions(8);
        const assertOnResults = <T>(results: Results<T>) => {
            const passed = getSucceeded(results);
            const failed = getFailed(results);

            expect(passed).toHaveLength(1);
            expect(passed).toContainEqual(
                ['test', 'value']
            );
            expect(failed).toHaveLength(1);
            expect(failed).toContainEqual(['sandwich', ERRORS.TIMED_OUT_SINGLE]);
        }
        first(hub, assertOnResults, ['test', 'sandwich'], 10);
        firstAsync(hub, ['test', 'sandwich'], 10).then(assertOnResults)
        hub.pub('test', 'value');
        jest.advanceTimersByTime(50);
        hub.pub('sandwich', 'reuben');
    }, 60);

    it('should return only the first message in a channel', () => {
        const hub = new Hub();
        const subcb = jest.fn();
        const assertOnResults = <T>(results: Results<T>) => {
            const passed = getSucceeded(results);
            expect(passed).toContainEqual(['test', 'value']);
            expect(passed).toContainEqual(['sandwich', 'reuben']);
        }
        expect.assertions(8);
        first(hub, assertOnResults, ['test', 'sandwich'], -1);
        firstAsync(hub, ['test', 'sandwich'], -1).then(assertOnResults)
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
        const assertOnResults = <T>(results: Results<T>) => {
            const passed = getSucceeded(results);
            expect(passed).toContainEqual(['test', 'value']);
            expect(passed).toContainEqual(['sandwich', 'club']);
        }
        expect.assertions(8);
        latest(hub, assertOnResults, ['test', 'sandwich'], -1);
        latestAsync(hub, ['test', 'sandwich'], -1).then(assertOnResults);
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
            const assertOnResults = <T>(results: Results<T>) => {
                const passed = getSucceeded(results);
                const failed = getFailed(results);
                expect(passed).toContainEqual(['test', 'value']);
                expect(passed).toContainEqual(['sandwich', 'club']);
                expect(failed).toContainEqual(['uncalled', ERRORS.TIMED_OUT_SINGLE]);
            }
            expect.assertions(10);
            latest(hub, assertOnResults, ['test', 'sandwich', 'uncalled'], 0);
            latestAsync(hub, ['test', 'sandwich', 'uncalled'], 0).then(assertOnResults)
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
            const assertOnResults = <T>(results: Results<T>) => {
                const passed = getSucceeded(results);
                const failed = getFailed(results);
                expect(passed).toContainEqual(['test', 'value']);
                expect(passed).toContainEqual(['sandwich', 'club']);
                expect(failed).toContainEqual(['late', ERRORS.TIMED_OUT_SINGLE]);
            }
            expect.assertions(10);
            latest(hub, assertOnResults, ['test', 'sandwich', 'late'], 0);
            latestAsync(hub, ['test', 'sandwich', 'late'], 0).then(assertOnResults);
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
            const assertOnResults = <T>(results: Results<T>) => {
                expect(results).toHaveLength(1);
                const failed = getFailed(results);
                expect(failed).toHaveLength(1);
                expect(failed).toStrictEqual([
                    ['*', ERRORS.TIMED_OUT_ALL],
                ]);
            }
            expect.assertions(10);

            latest(hub, assertOnResults, ['test', 'sandwich'], 0);
            latestAsync(hub, ['test', 'sandwich'], 0).then(assertOnResults)

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

describe('expecting routes', () => {
    describe('registered routes', () => {
        it('thinking', () => {
            const hub = new Hub();
            latest(hub, console.log, [/.*/], 10, {fastReturn: true})
            setExpected(hub, '*wich');
            const val = resolveRoute('sandwich', hub.metadata.get(METADATA.FAST_RETURN));
            expect([...val]).toContain('*wich')
            latest(hub, jest.fn(), ['sandwich'], 10, {fastReturn: true}); // 'sandwich' is expected.
            latest(hub, jest.fn(), ['sand*'], 10, {fastReturn: true}); // 'sand*' is not expected.
            // ...even though both of these will match `sandwich`.
            hub.pub('sandwich', 'reuben'); // I would expect this to be...expected.
            // We don't need to worry about pubs which might fire; we only need to care about the route(s)
            // the we have explicitly said to expect.
        });
    })

    describe('first', () => {
        it('should return with all rejections if no routes are registered', () => {
            const hub = new Hub();
            const fastReturns = hub.metadata.get(METADATA.FAST_RETURN);
            const assertOnResults = <T>(results: Results<T>) => {
                expect(results).toHaveLength(1);
                expect(results).toStrictEqual([[0, 'sandwich', ERRORS.EXPECTED]]);
            }
            expect.assertions(5);
            expect(fastReturns).toHaveLength(0);
            first(hub, assertOnResults, ['sandwich'], 10, true);
            firstAsync(hub, ['sandwich'], 10, true).then(assertOnResults);
            hub.pub('sandwich', 'reuben');
            jest.advanceTimersByTime(10);
        });

        it('should wait for routes which are expected', () => {
            const hub = new Hub();
            let hasResolved = false;
            const assertOnResultsEarly = <T>(results: Results<T>) => {
                hasResolved = true;
            }
            setExpected(hub, 'sandwich');

            expect(hub.metadata.get(METADATA.FAST_RETURN)).toStrictEqual(['sandwich']);
        })
    });
   it('when no routes have been expected.', () => {
       expect.assertions(2);
       const hub = new Hub();
       first(hub, (results) => {
           expect(results.length).toBe(0);
           expect(results.failed).toStrictEqual([['sandwich', ERRORS.EXPECTED]]);
       }, ['sandwich'], 10, true);
       hub.pub('sandwich', 'reuben');
       jest.advanceTimersByTime(100);
   });

   it('wait when route is expected', () => {
       const hub = new Hub();
       shouldExpect(hub, 'sandwich');
       first(hub, (results) => {
           expect(results.length).toBe(1);
           expect(results).toContainEqual(['sandwich', 'reuben']);
       }, ['sandwich'], 10, true)
       hub.pub('sandwich', 'reuben');
       jest.advanceTimersByTime(10);
   });

   it.each([
       ['expected sandwich', ['sandwich'], true, ['sandwich'], [['sandwich', 'reuben']]],
       ['expected sandwich, starship', ['sandwich'], true, ['sandwich', 'starship'], [['sandwich', 'reuben']]],
       ['expected sandwich, salad', ['sandwich', 'salad'], true, ['sandwich', 'salad'], [['sandwich', 'reuben'], ['salad', 'caesar']]],
       ['expected salad, listening for sandwich & salad', ['sandwich', 'salad'], true, ['salad'], [['sandwich', 'reuben'], ['salad', 'caesar']]],
       ['no expected sandwich', ['sandwich'], true, [], [], [['sandwich', ERRORS.EXPECTED]]],
   ])('expecting: %s', (_, channels, expectArg, expected, resultMatch, failedMatch: string[][]|null = null) => {
       let assertions = 2 + resultMatch.length;
       expect.assertions(assertions);
       const hub = new Hub();
       shouldExpect(hub, ...expected);
       const promise = firstAsync(hub, channels, 10, expectArg);
       hub.pub('sandwich', 'reuben');
       jest.advanceTimersByTime(5);
       hub.pub('salad', 'caesar');
       if (failedMatch) {
           expect(promise).resolves.toHaveProperty('failed', failedMatch);
       } else {
           expect(promise).resolves.not.toHaveProperty('failed', failedMatch);
       }
       expect(promise).resolves.toHaveLength(resultMatch.length);
       resultMatch.forEach(match => expect(promise).resolves.toContainEqual(match));
   });
});