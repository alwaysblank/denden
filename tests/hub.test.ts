import Hub from '../src/hub';
import Message from '../src/message';
import Channel from "../src/channel";
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
        expect(hub.query({cid:'test', limit: Infinity})).toHaveLength(3);
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
        expect(hub.query({cid:'test', limit: Infinity})).toHaveLength(4);
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

    it('should allow unsubscribing from a channel, preventing any further callbacks', () => {
        const hub = new Hub();
        const callback = jest.fn();
        const unsub = hub.sub('test', callback);
        hub.pub('test', 'sandwich');
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
        expect(hub.query({cid:'test', limit: Infinity})).toHaveLength(1)
        unsub();
        hub.pub('test', 'hamburger');
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
        expect(callback).not.toHaveBeenCalledWith('hamburger', expect.toHaveChannel('test'), expect.any(Function));
        expect(hub.query({cid:'test', limit: Infinity})).toHaveLength(2);

        const inner = jest.fn();
        hub.sub('test', (payload, channel, unsub) => {
            inner(payload);
            unsub();
        });
        hub.pub('test', 'salad');
        hub.pub('test', 'ice cream');
        expect(inner).toHaveBeenCalledTimes(1);
        expect(inner).toHaveBeenCalledWith('salad');
        expect(inner).not.toHaveBeenCalledWith('ice cream');
    });

    it('should allow unsubscribing while parsing previous message', () => {
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
    })

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

        // We have to do this because Hub doesn't expose a way to insert a channel by itself--it doesn't need to.
        // @ts-expect-error
        hub.channels.set('test', new Channel('test'));

        // We have to do this because Hub doesn't give us public access to the channels it tracks--we shouldn't need that normally, and we don't want people messing with them.
        // @ts-expect-error
        const msg = Message.create(hub.channels.get('test'), 'valid message');

        // We finally send a valid message!
        hub.dispatchEvent(msg);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('valid message', expect.toHaveChannel('test'), expect.any(Function));
    });

    it('should allow publishing to multiple channels', () => {
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

	it('promise returned by pub() contains callback returns in call order', (done) => {
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

	it('hub() promise contains only returns for that event', () => {
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
});

describe('Other message sources', () => {
    it('should ingest messages from processing other events', () => {
        const emitter = new EventTarget();
        const hub = new Hub();
        const callback = jest.fn();
        const unwatch = hub.watch('emitter', emitter, 'test', e => e.type);
        hub.sub('emitter', callback);
        emitter.dispatchEvent(new Event('test'));
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('test', expect.toHaveChannel('emitter'), expect.any(Function));
        expect(hub.query({cid:'emitter', limit: Infinity})).toHaveLength(1);
        unwatch();
        emitter.dispatchEvent(new Event('test'));
        expect(callback).toHaveBeenCalledTimes(1);
        expect(hub.query({cid:'emitter', limit: Infinity})).toHaveLength(1);
    });
});

describe('Retrieving messages directly', () => {
    it('should retrieve messages that match a query', () => {
        const hub = new Hub();
        hub.pub('test', 'sandwich');
        hub.pub('test', 'hamburger');
        hub.pub('test', 'salad');
        expect(hub.query({cid:'test', limit: Infinity})).toHaveLength(3); // Default is to return all.
        expect(hub.query({cid: 'test', limit: 1})).toHaveLength(1);
        expect(hub.query({cid: 'test', limit: 1, order: 'ASC'})).toHaveLength(1);
        expect(hub.query({cid: 'test', limit: 2})).toHaveLength(2);
        expect(hub.query({cid: 'test', limit: 1})[0].payload).toBe('salad'); // Should return last item.
        expect(hub.query({cid: 'test', limit: 1, order: 'ASC'})[0].payload).toBe('sandwich'); // Should return first item.
        expect(hub.query({cid: 'does not exist', limit: 10})).toStrictEqual([]);
    });

    it('should allow queries to get messages from multiple channels', () => {
        const hub = new Hub();

        hub.pub('test/1', 'test one');
        hub.pub('test/2', 'test two');
        hub.pub('test/3', 'test three');
        hub.pub('sandwich/reuben', ['russian dressing', 'pastrami']);

        const all = hub.query({cid:'*', limit: Infinity});
        expect(all).toHaveLength(4);
        expect(all.map(m => m.payload)).toStrictEqual([
            ['russian dressing', 'pastrami'],
            'test three',
            'test two',
            'test one',
        ]);

        const allReverse = hub.query({cid: '*', limit: Infinity, order: 'ASC'});
        expect(allReverse).toHaveLength(4);
        expect(allReverse.map(m => m.payload)).toStrictEqual([
            'test one',
            'test two',
            'test three',
            ['russian dressing', 'pastrami'],
        ]);

        const regex = hub.query( {cid: /test\/2|sandwich\/\w+/, limit: Infinity});
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
        const empty = hub.query({});
        expect(empty).toEqual([]);
    });
});
