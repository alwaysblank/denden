import Hub from '../src/hub';
import Message from '../src/message';
import Channel from "../src/channel";
import {describe, expect} from '@jest/globals';

const toBeMessageFromChannel = (actual: unknown, payload: unknown, channel: string) => {
    if (!(actual instanceof Message)) {
        throw new TypeError('Expected a message but got something else!');
    }
    const pass = actual.payload === payload && actual.channel.name === channel;
    const errorMessage = () => {
        const errors = [];
        if (actual.payload !== payload) {
            errors.push(`expected ${JSON.stringify(payload)}, got ${JSON.stringify(actual.payload)}`);
        }
        if (actual.channel.name !== channel) {
            errors.push(`expected ${channel}, got ${actual.channel.name}`);
        }
        return errors.join(';');
    }
    if (pass) {
        return {
            message: errorMessage,
            pass: true,
        }
    } else {
        return {
            message: errorMessage,
            pass: false,
        }
    }
}

const toHaveChannel = (actual: Partial<{channel: {name: string}}>, channel: string) => {
    const actualChannel = actual?.channel?.name;
    const errMsg = () => {
        return `expected ${channel}, got ${actualChannel || 'no channel found'}`;
    }
    if (actualChannel === channel) {
        return {
            message: errMsg,
            pass: true,
        }
    }
    return {
        message: errMsg,
        pass: false,
    }
}

expect.extend({
    toBeMessageFromChannel,
    toHaveChannel,
});

declare module 'expect' {
    interface AsymmetricMatchers {
        toBeMessageFromChannel(payload: unknown, channel: string): void;
        toHaveChannel(channel: string): void;
    }
    interface Matchers<R> {
        toBeMessageFromChannel(payload: unknown, channel: string): R;
        toHaveChannel(channel: string): R;
    }
}


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

    it('should run callback only once', () => {
        const hub = new Hub();
        const once = jest.fn();
        const every = jest.fn();

        hub.sub('test', every);
        hub.once('test', once);

        expect(once).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.pub('test', 'value');

        expect(once).toHaveBeenCalledTimes(1);
        expect(every).toHaveBeenCalledTimes(1);

        hub.pub('test', 'value2');

        expect(once).toHaveBeenCalledTimes(1);
        expect(every).toHaveBeenCalledTimes(2);
    });

    it('should respect onlyFuture argument when running once', () => {
        const hub = new Hub();
        const once = jest.fn();
        const onceFuture = jest.fn();
        const every = jest.fn();

        hub.pub('test', 'past');

        expect(hub.query({cid:'test', limit: Infinity})).toHaveLength(1);
        expect(once).toHaveBeenCalledTimes(0);
        expect(onceFuture).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.sub('test', every);
        hub.once('test', once);
        hub.once('test', onceFuture, true);

        expect(once).toHaveBeenCalledTimes(1);
        expect(onceFuture).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.pub('test', 'new');

        expect(once).toHaveBeenCalledTimes(1);
        expect(onceFuture).toHaveBeenCalledTimes(1);
        expect(every).toHaveBeenCalledTimes(1);

        hub.pub('test', 'new');

        expect(once).toHaveBeenCalledTimes(1);
        expect(onceFuture).toHaveBeenCalledTimes(1);
        expect(every).toHaveBeenCalledTimes(2);

    });

    it('should respect only() condition', () => {
       const hub = new Hub();
       const cond = jest.fn();
       const every = jest.fn();

       const onlyConditional = (payload: string) => {
           return payload === 'sandwich';
       }

       expect(cond).toHaveBeenCalledTimes(0);
       expect(every).toHaveBeenCalledTimes(0);

       hub.only('test', cond, onlyConditional);
       hub.sub('test', every);

       hub.pub('test', 'burrito');
       hub.pub('test', 'sandwich');
       hub.pub('test', 'pizza');

       expect(every).toHaveBeenCalledTimes(3);
       expect(cond).toHaveBeenCalledTimes(1);
       expect(cond).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
    });

    it('should respect only() condition and onlyFuture', () => {
        const hub = new Hub();
        const future = jest.fn();
        const cond = jest.fn();
        const every = jest.fn();

        const onlyConditional = (payload: string) => {
            return payload === 'sandwich' || payload === 'pizza';
        }

        expect(future).toHaveBeenCalledTimes(0);
        expect(cond).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.pub('test', 'pizza');

        hub.only('test', future, onlyConditional, true);
        hub.only('test', cond, onlyConditional);
        hub.sub('test', every);

        hub.pub('test', 'burrito');
        hub.pub('test', 'sandwich');

        expect(every).toHaveBeenCalledTimes(2);
        expect(future).toHaveBeenCalledTimes(1);
        expect(future).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
        expect(cond).toHaveBeenCalledTimes(2);
        expect(cond).toHaveBeenCalledWith('pizza', expect.toHaveChannel('test'), expect.any(Function));
        expect(cond).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
    });

    it('should stop when until() condition is met', () => {
       const hub = new Hub();
       const until = jest.fn();
       const every = jest.fn();

       const untilConditional = (payload: number) => {
           return payload > 1;
       }

       expect(until).toHaveBeenCalledTimes(0);
       expect(every).toHaveBeenCalledTimes(0);

       hub.until('test', until, untilConditional);
       hub.sub('test', every);

       expect(until).toHaveBeenCalledTimes(0);
       expect(every).toHaveBeenCalledTimes(0);

       hub.pub('test', 0);
       expect(until).toHaveBeenCalledTimes(1);
       expect(every).toHaveBeenCalledTimes(1);

       hub.pub('test', 1);
       expect(until).toHaveBeenCalledTimes(2);
       expect(every).toHaveBeenCalledTimes(2);

        hub.pub('test', 2);
        expect(until).toHaveBeenCalledTimes(2);
        expect(every).toHaveBeenCalledTimes(3);

        hub.pub('test', 3);
        expect(until).toHaveBeenCalledTimes(2);
        expect(every).toHaveBeenCalledTimes(4);
    });

    it('should stop when until() condition is met (high start)', () => {
        const hub = new Hub();
        const until = jest.fn();
        const every = jest.fn();

        const untilConditional = (payload: number) => {
            return payload > 1;
        }

        expect(until).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.until('test', until, untilConditional);
        hub.sub('test', every);

        expect(until).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.pub('test', 10);

        expect(until).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(1);

        hub.pub('test', 0);

        expect(until).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(2);
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
})
