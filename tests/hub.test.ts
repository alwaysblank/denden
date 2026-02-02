import {CallbackError, ErrorEvent, Hub, Message} from '../src';
import {describe, expect} from '@jest/globals';
import "../definitions/toHaveChannel.d.ts"

afterEach(() => {
    jest.restoreAllMocks();
});

describe('Hub creation', () => {
    it('Create a hub', () => {
        const hub = new Hub();
        expect(hub).toBeInstanceOf(Hub);
    });
})

describe('Subscribing & Publishing', () => {
    it('should receive a published message', () => {
        const hub = new Hub();
        const callback = jest.fn();
        hub.sub('test', callback);
        hub.pub('test', 'sandwich');
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
    });

    it('should receive multiple published messages', () => {
        const hub = new Hub();
        const callback = jest.fn();
        hub.sub('test', callback);
        hub.pub('test', 'sandwich');
        hub.pub('test', 'hamburger');
        hub.pub('test', 'salad');
        expect(callback).toHaveBeenCalledTimes(3);
        expect(callback).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
        expect(callback).toHaveBeenCalledWith('hamburger', expect.toHaveChannel('test'), expect.any(Function));
        expect(callback).toHaveBeenCalledWith('salad', expect.toHaveChannel('test'), expect.any(Function));
        expect(hub.getMessages({cid:'test', limit: Infinity})).toHaveLength(3);
    });

    it('should allow one subscriber to specify multiple channels', () => {
        const hub = new Hub();

        const getAll = jest.fn();
        hub.sub('test/*', getAll);

        const getRegex = jest.fn();
        hub.sub(/test\/[1-2]/, getRegex);

        hub.pub('test/1', 'test one');
        hub.pub('test/2', 'test two');
        hub.pub('test/3', 'test three');

        expect(getAll).toHaveBeenCalledTimes(3);
        expect(getAll).toHaveBeenCalledWith('test one', expect.toHaveChannel('test/1'), expect.any(Function));
        expect(getAll).toHaveBeenCalledWith('test two', expect.toHaveChannel('test/2'), expect.any(Function));
        expect(getAll).toHaveBeenCalledWith('test three', expect.toHaveChannel('test/3'), expect.any(Function));
        expect(getRegex).toHaveBeenCalledTimes(2);
        expect(getRegex).toHaveBeenCalledWith('test one', expect.toHaveChannel('test/1'), expect.any(Function));
        expect(getRegex).toHaveBeenCalledWith('test two', expect.toHaveChannel('test/2'), expect.any(Function));
        expect(getRegex).not.toHaveBeenCalledWith('test three', expect.toHaveChannel('test/3'), expect.any(Function));
    });

    it('should receive previously published messages on subscription', () => {
        const hub = new Hub();
        const callback = jest.fn();
        hub.pub('test', 'sandwich');
        const unsub1 = hub.sub('test', callback, 1);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
        unsub1(); // Remote first sub.
        hub.pub('test', 'hamburger');
        hub.pub('test', 'salad');
        hub.pub('test', 'ice cream');
        expect(hub.getMessages({cid:'test', limit: Infinity})).toHaveLength(4);
        const callback2items = jest.fn();
        const callbackAllItems = jest.fn();

        hub.sub('test', callback2items, 2);
        expect(callback2items).toHaveBeenCalledTimes(2);
        expect(callback2items).toHaveBeenCalledWith('ice cream', expect.toHaveChannel('test'), expect.any(Function));
        expect(callback2items).toHaveBeenCalledWith('salad', expect.toHaveChannel('test'), expect.any(Function));
        expect(callback2items).not.toHaveBeenCalledWith('hamburger', expect.toHaveChannel('test'), expect.any(Function));
        expect(callback2items).not.toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));


        hub.sub('test', callbackAllItems, Infinity);
        expect(callbackAllItems).toHaveBeenCalledTimes(4);
        expect(callbackAllItems).toHaveBeenCalledWith('ice cream', expect.toHaveChannel('test'), expect.any(Function));
        expect(callbackAllItems).toHaveBeenCalledWith('salad', expect.toHaveChannel('test'), expect.any(Function));
        expect(callbackAllItems).toHaveBeenCalledWith('hamburger', expect.toHaveChannel('test'), expect.any(Function));
        expect(callbackAllItems).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
    });

    it('should receive no previously published messages by default', () => {
        const hub = new Hub();
        const callback = jest.fn();
        hub.pub('test', 'sandwich');
        hub.sub('test', callback);
        expect(callback).toHaveBeenCalledTimes(0);
    });

	it('should allow only valid messages to be sent to a subscriber callback', () => {
		const hub = new Hub();
		const callback = jest.fn();
		hub.sub('test', callback)

		// This seems to have the right name, but it's just an Event.
		hub.dispatchEvent(new Event('test'));
		expect(callback).toHaveBeenCalledTimes(0);

		// This is a properly published message, but it's to the wrong channel.
		hub.pub('sausage', 'sandwich');
		expect(callback).toHaveBeenCalledTimes(0);

		// This is an event with the same (static) name property as Message, but it's not a Message.
		const evt = new Event(Message.NAME);
		hub.dispatchEvent(evt);
		expect(callback).toHaveBeenCalledTimes(0);

		hub.makeChannel('test');

		const msg = Message.create('test', 'valid message');

		// We finally send a valid message!
		hub.dispatchEvent(msg);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith('valid message', expect.toHaveChannel('test'), expect.any(Function));
	});

	describe('routing', () => {
		it.each([
			[['sandwich'], [['reuben']]],
			[['starship'], [['cerritos']]],
			[['starship', 'sandwich'], [['cerritos'], ['reuben']]],
			[['s*'], [['reuben', 'cerritos']]],
			[['*'], [['reuben', 'cerritos', 'earth']]],
			[[/^s.*i.*/], [['reuben', 'cerritos']]],
			[['*i*'], [[]]], // This kind of match is not supported; use RegEx instead.
			[[/i/], [['reuben', 'cerritos']]],
			[[/.*/], [['reuben', 'cerritos', 'earth']]],
			[[/^s/], [['reuben', 'cerritos']]],
			[[/s$/], [['earth']]],
			[['starship', 'salad'], [['cerritos'], []]],
		])('route %p', (channel, expected) => {
			const assertions = channel.reduce((acc, __, i) => {
				let lng = expected[i].length;
				if ( 0 === lng ) {
					lng = 1; // If we expect no results, then we will be expecting the callback not to have been called--so at least one assertion.
				}
				return acc + lng;
			}, 0);
			expect.assertions(assertions);
			const hub = new Hub();
			const subs = channel.map(c => {
				const cb = jest.fn();
				hub.sub(c, cb);
				return cb;
			});
			hub.pub('sandwich', 'reuben');
			hub.pub('starship', 'cerritos');
			hub.pub('elements', 'earth');
			subs.forEach((cb, i) => {
				if (expected[i].length === 0) {
					expect(cb).not.toHaveBeenCalled();
				} else {
					expected[i].forEach(e => {
						expect(cb).toHaveBeenCalledWith(e, expect.any(Object), expect.any(Function));
					});
				}
			});
		});
	});

	describe('unsubscribing', () => {
		it('should prevent further callback invocations', () => {
			const hub = new Hub();
			const callback = jest.fn();
			const unsub = hub.sub('test', callback);
			hub.pub('test', 'sandwich');
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
			expect(hub.getMessages({cid:'test', limit: Infinity})).toHaveLength(1)
			unsub();
			hub.pub('test', 'hamburger');
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
			expect(callback).not.toHaveBeenCalledWith('hamburger', expect.toHaveChannel('test'), expect.any(Function));
			expect(hub.getMessages({cid:'test', limit: Infinity})).toHaveLength(2);

			const inner = jest.fn();
			hub.sub('test', (payload, channel, unsub) => {
				inner(payload, channel);
				unsub();
			});
			hub.pub('test', 'salad');
			hub.pub('test', 'ice cream');
			expect(inner).toHaveBeenCalledTimes(1);
			expect(inner).toHaveBeenCalledWith('salad', expect.toHaveChannel('test'));
			expect(inner).not.toHaveBeenCalledWith('ice cream', expect.toHaveChannel('test'));
		});

		it('should prevent processing of additional backlog messages', () => {
			const hub = new Hub();
			const once = jest.fn();
			const all = jest.fn();
			hub.pub('test', 'sandwich');
			hub.pub('test', 'hamburger');
			hub.pub('test', 'salad');

			let i = 0;
			hub.sub('test', (payload, channel, unsub) => {
				if (i++ > 0) {
					return unsub();
				}
				once(payload, channel, unsub);
			}, 3);
			hub.sub('test', all, 4);

			expect(once).toHaveBeenCalledTimes(1);
			expect(once).toHaveBeenCalledWith('salad', expect.toHaveChannel('test'), expect.any(Function));

			expect(all).toHaveBeenCalledTimes(3);
			expect(all).toHaveBeenCalledWith('salad', expect.toHaveChannel('test'), expect.any(Function));
			expect(all).toHaveBeenCalledWith('hamburger', expect.toHaveChannel('test'), expect.any(Function));
			expect(all).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
		});
	});
	describe('multi-channel publishing', () => {
		it('should publish messages to multiple channels at once', () => {
			const hub = new Hub();
			const cb1 = jest.fn();
			const cb2 = jest.fn();

			hub.sub('test', cb1);
			hub.sub('sandwich', cb2);

			hub.pub(['test', 'sandwich'], 'payload');

			expect(cb1).toHaveBeenCalledTimes(1);
			expect(cb1).toHaveBeenCalledWith('payload', expect.toHaveChannel('test'), expect.any(Function));
			expect(cb2).toHaveBeenCalledTimes(1);
			expect(cb2).toHaveBeenCalledWith('payload', expect.toHaveChannel('sandwich'), expect.any(Function));
		});
	});

	describe('callback resolution', () => {
		it('should return callback results in call order', (done) => {
			jest.useFakeTimers();
			expect.assertions(5);
			const hub = new Hub();
			const cb1 = jest.fn(() => {
				return 'one';
			});
			const cb2 = jest.fn(() => {
				return new Promise(resolve => setTimeout(() => resolve('two'), 1000));
			});
			const cb3 = jest.fn(() => {
				return new Promise((_, reject) => setTimeout(() => reject('three'), 1000));
			});
			const cb4 = jest.fn(() => {
				return 'four';
			});
			hub.sub('test', cb1);
			hub.sub('test', cb2);
			hub.sub('test', cb3);
			hub.sub('test', cb4);

			hub.pub('test', 'published value')
				.then(results => {
					expect(cb1).toHaveBeenCalledWith('published value', expect.toHaveChannel('test'), expect.any(Function));
					expect(cb2).toHaveBeenCalledWith('published value', expect.toHaveChannel('test'), expect.any(Function));
					expect(cb3).toHaveBeenCalledWith('published value', expect.toHaveChannel('test'), expect.any(Function));
					expect(cb4).toHaveBeenCalledWith('published value', expect.toHaveChannel('test'), expect.any(Function));
					expect(results).toStrictEqual(['one', 'two', expect.objectContaining({message: 'three'}), 'four']);
					done();
				});

			jest.advanceTimersByTime(1000);
		});

		it('should contain only results for the specified payload', () => {
			const hub = new Hub();
			const returnFalse = () => false;
			const returnTrue = () => true;
			const returnFive = () => 5;
			const returnTen = () => 10;

			hub.sub('test/1', returnFalse);

			hub.pub('test/1', 'published value')
				.then(result => {
					expect(result).toStrictEqual([false]);
				})

			const unsub = hub.sub('test/1', returnTen);

			hub.pub('test/1', 'published value')
				.then(result => {
					expect(result).toStrictEqual([false, 10]);
				})

			unsub();

			hub.sub('test/1', returnTrue)
			hub.sub('test/1', returnFive);

			hub.pub('test/1', 'published value')
				.then(result => {
					expect(result).toStrictEqual([false, true, 5]);
				})
		});

		it('should not consider strictly-equal payloads on different messages to be the same', () => {
			expect.assertions(2);
			const hub = new Hub();
			const payloadScalar = 'payload';

			hub.sub('test/1', (payload) => `cb1: ${payload}`);
			hub.sub('test/2', (payload) => `cb2: ${payload}`);

			hub.pub('test/1', payloadScalar)
				.then(result => {
					expect(result).toStrictEqual(['cb1: payload']);
				});
			hub.pub('test/2', payloadScalar)
				.then(result => {
					expect(result).toStrictEqual(['cb2: payload']);
				});
		});

		it('should clear list of running commands all have been processed', async () => {
			expect.assertions(9);
			const hub = new Hub();
			const payloadScalar = 'payload';
			// @ts-expect-error -- We're accessing a private field here for testing purposes.
			const running = hub.running;
			let contains: {payload: any} = {payload: false};

			hub.sub('test', (payload, message) => {
				expect(payload).toEqual(payloadScalar);
				contains = message.contains;
				expect(running.get(contains)).toBeUndefined();
				return 'cb1';
			})
			hub.sub('test', (payload, message) => {
				expect(payload).toEqual(payloadScalar);
				contains = message.contains;
				expect(running.get(contains)).toStrictEqual(['cb1'])
				return 'cb2';
			});

			expect(running.get(contains)).toBeUndefined();
			const result = hub.pub('test', payloadScalar);
			expect(running.get(contains)).toStrictEqual(['cb1', 'cb2']);
			await result.then(success => {
				// Because cleanup happens in the `finally()` clause, the full list of callbacks is still available at this point.
				expect(running.get(contains)).toStrictEqual(['cb1', 'cb2']);
				expect(success).toStrictEqual(['cb1', 'cb2']);
			});
			expect(running.get(contains)).toBeUndefined();
		});
	});

	describe('error handling', () => {
		it('should capture report errors returned by subscribers', () => {
			expect.assertions(6);
			const hub = new Hub();
			hub.sub('test', () => 'cb1');
			hub.sub('test', () => {throw new Error('cb2')});
			hub.sub('test', () => 'cb2');
			hub.pub('test', 'published value')
				.then(success => {
					expect(success.length).toBe(3);
					const [cb1, cb2, cb3] = success as [string, CallbackError, string];
					expect(cb1).toBe('cb1');
					expect(cb2).toBeInstanceOf(CallbackError);
					expect(cb2.message).toBe(CallbackError.NAME);
					expect(cb2.cause).toBeInstanceOf(Error);
					expect(cb3).toBe('cb2');
				});
		});

		it('should dispatch an event when an error is thrown', () => {
			expect.assertions(3);
			const hub = new Hub();
			const err = new Error('cb1');
			hub.sub('test', () => {throw err});
			hub.addEventListener(ErrorEvent.NAME, (e) => {
				const error = e as ErrorEvent;
				expect(error).toBeInstanceOf(ErrorEvent);
				expect(error.cause).toBeInstanceOf(CallbackError);
				expect(error.cause.cause).toBe(err);
			});
			hub.pub('test', 'published value');
		});

		it('should handle non-error thrown values', () => {
			const hub = new Hub();
			const thrown = {msg: 'throw me'};
			hub.sub('test', () => {throw thrown});
			hub.addEventListener(ErrorEvent.NAME, (e) => {
				const errorEvent = e as ErrorEvent;
				expect(errorEvent).toBeInstanceOf(ErrorEvent);
				expect(errorEvent.cause).toBeInstanceOf(Error);
				expect(errorEvent.cause.message).toBe('Caught a non-Error error');
				expect(errorEvent.cause.cause).toBeInstanceOf(CallbackError);
				expect((errorEvent.cause.cause as CallbackError).cause).toBe(thrown);
			});
			hub.pub('test', 'published value')
				.then(success => {
					const [error] = success;
					expect(error).toHaveProperty('message', CallbackError.NAME);
					expect(error).toHaveProperty('cause', thrown);
					return;
				});
		})
	});
});

describe('Retrieving messages directly', () => {
    it('should retrieve messages that match a query', () => {
        const hub = new Hub();
        hub.pub('test', 'sandwich');
        hub.pub('test', 'hamburger');
        hub.pub('test', 'salad');
        expect(hub.getMessages({cid:'test', limit: Infinity})).toHaveLength(3); // Default is to return all.
        expect(hub.getMessages({cid: 'test', limit: 1})).toHaveLength(1);
        expect(hub.getMessages({cid: 'test', limit: 1, order: 'ASC'})).toHaveLength(1);
        expect(hub.getMessages({cid: 'test', limit: 2})).toHaveLength(2);
        expect(hub.getMessages({cid: 'test', limit: 1})[0].payload).toBe('salad'); // Should return last item.
        expect(hub.getMessages({cid: 'test', limit: 1, order: 'ASC'})[0].payload).toBe('sandwich'); // Should return first item.
        expect(hub.getMessages({cid: 'does not exist', limit: 10})).toStrictEqual([]);
    });

    it('should allow queries to get messages from multiple channels', () => {
        const hub = new Hub();

        hub.pub('test/1', 'test one');
        hub.pub('test/2', 'test two');
        hub.pub('test/3', 'test three');
        hub.pub('sandwich/reuben', ['russian dressing', 'pastrami']);

        const all = hub.getMessages({cid:'*', limit: Infinity});
        expect(all).toHaveLength(4);
        expect(all.map(m => m.payload)).toStrictEqual([
            ['russian dressing', 'pastrami'],
            'test three',
            'test two',
            'test one',
        ]);

        const allReverse = hub.getMessages({cid: '*', limit: Infinity, order: 'ASC'});
        expect(allReverse).toHaveLength(4);
        expect(allReverse.map(m => m.payload)).toStrictEqual([
            'test one',
            'test two',
            'test three',
            ['russian dressing', 'pastrami'],
        ]);

        const regex = hub.getMessages( {cid: /test\/2|sandwich\/\w+/, limit: Infinity});
        expect(regex).toHaveLength(2);
        expect(regex.map(m => m.payload)).toStrictEqual([
            ['russian dressing', 'pastrami'],
            'test two',
        ])
    });

    it('should fail nicely if no channel is specified', () => {
        const hub = new Hub();

        hub.pub('test/1', 'test one');
        hub.pub('test/2', 'test two');
        hub.pub('test/3', 'test three');

        // We want to test a state that TypeScript would like to prevent--but it can't prevent at runtime.
        // @ts-expect-error
        const empty = hub.getMessages({});
        expect(empty).toEqual([]);
    });
});

describe('Channel management', () => {
	it('should reject non-Message events', () => {
		expect.assertions(1);
		const hub = new Hub();
		// @ts-expect-error -- We want to deal with a channel directly for testing purposes.
		const channel = hub.channel('test');
		// @ts-expect-error -- We want to test a bad event type.
		expect(() => channel.push(new Event('not a message'))).toThrowError(new Error('Channels can only contain Messages.'));
	});

	it('should error on wildcard channel creation', () => {
		expect.assertions(4);
		const hub = new Hub();
		expect(() => hub.makeChannel('*')).toThrowError(new Error('Channel names cannot contain wildcards.'));
		expect(() => hub.makeChannel('sand*')).toThrowError(new Error('Channel names cannot contain wildcards.'));
		expect(() => hub.makeChannel('*wich')).toThrowError(new Error('Channel names cannot contain wildcards.'));
		expect(() => hub.makeChannel('sa*ch')).toThrowError(new Error('Channel names cannot contain wildcards.'));
	})
})

describe('Message', () => {
	it('should return a message', () => {
		const message = Message.create('test', 'message payload');
		expect(message.payload).toEqual('message payload');
		expect(message.channel).toBe('test'); // This should be a reference to the channel, not just something that looks like it.
		expect(typeof message.order).toEqual('number');
	});

	it('should return properly formed JSON', () => {
		const message = Message.create('test', 'message payload');
		const JSONObject = message.toJSON();
		expect(JSONObject.payload).toEqual('message payload');
		expect(JSONObject.channel).toEqual('test');
		expect(typeof JSONObject.order).toEqual('number');

		const str = JSON.stringify(message);
		expect(JSON.parse(str)).toEqual(JSONObject);
	})
});
