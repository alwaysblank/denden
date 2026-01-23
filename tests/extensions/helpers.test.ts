import Hub from "../../src/hub";
import {expect} from "@jest/globals";
import {once, only, until} from "../../extensions/helpers";
import "../../definitions/toHaveChannel.d.ts"


describe('once', () => {
    it('should run callback only once', () => {
        const hub = new Hub();
        const doOnce = jest.fn();
        const every = jest.fn();

        hub.sub('test', every);
        once(hub, 'test', doOnce);

        expect(doOnce).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.pub('test', 'value');

        expect(doOnce).toHaveBeenCalledTimes(1);
        expect(every).toHaveBeenCalledTimes(1);

        hub.pub('test', 'value2');

        expect(doOnce).toHaveBeenCalledTimes(1);
        expect(every).toHaveBeenCalledTimes(2);
    });

    it('should respect onlyFuture argument when running once', () => {
        const hub = new Hub();
        const doOnce = jest.fn();
        const onceFuture = jest.fn();
        const every = jest.fn();

        hub.pub('test', 'past');

        expect(hub.getMessages({cid:'test', limit: Infinity})).toHaveLength(1);
        expect(doOnce).toHaveBeenCalledTimes(0);
        expect(onceFuture).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.sub('test', every);
        once(hub, 'test', doOnce);
        once(hub, 'test', onceFuture, true);

        expect(doOnce).toHaveBeenCalledTimes(1);
        expect(onceFuture).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.pub('test', 'new');

        expect(doOnce).toHaveBeenCalledTimes(1);
        expect(onceFuture).toHaveBeenCalledTimes(1);
        expect(every).toHaveBeenCalledTimes(1);

        hub.pub('test', 'new');

        expect(doOnce).toHaveBeenCalledTimes(1);
        expect(onceFuture).toHaveBeenCalledTimes(1);
        expect(every).toHaveBeenCalledTimes(2);

    });
});

describe('until', () => {
    it('should stop when until() condition is met', () => {
        const hub = new Hub();
        const onUntil = jest.fn();
        const every = jest.fn();

        const untilConditional = (payload: number) => {
            return payload > 1;
        }

        expect(onUntil).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        until(hub, 'test', onUntil, untilConditional);
        hub.sub('test', every);

        expect(onUntil).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.pub('test', 0);
        expect(onUntil).toHaveBeenCalledTimes(1);
        expect(every).toHaveBeenCalledTimes(1);

        hub.pub('test', 1);
        expect(onUntil).toHaveBeenCalledTimes(2);
        expect(every).toHaveBeenCalledTimes(2);

        hub.pub('test', 2);
        expect(onUntil).toHaveBeenCalledTimes(2);
        expect(every).toHaveBeenCalledTimes(3);

        hub.pub('test', 3);
        expect(onUntil).toHaveBeenCalledTimes(2);
        expect(every).toHaveBeenCalledTimes(4);
    });

    it('should stop when until() condition is met (high start)', () => {
        const hub = new Hub();
        const onUntil = jest.fn();
        const every = jest.fn();

        const untilConditional = (payload: number) => {
            return payload > 1;
        }

        expect(onUntil).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        until(hub, 'test', onUntil, untilConditional);
        hub.sub('test', every);

        expect(onUntil).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.pub('test', 10);

        expect(onUntil).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(1);

        hub.pub('test', 0);

        expect(onUntil).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(2);
    });
});

describe('only', () => {
    it('should respect only() condition', () => {
        const hub = new Hub();
        const onOnly = jest.fn();
        const every = jest.fn();

        const onlyConditional = (payload: string) => {
            return payload === 'sandwich';
        }

        expect(onOnly).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        only(hub, 'test', onOnly, onlyConditional);
        hub.sub('test', every);

        hub.pub('test', 'burrito');
        hub.pub('test', 'sandwich');
        hub.pub('test', 'pizza');

        expect(every).toHaveBeenCalledTimes(3);
        expect(onOnly).toHaveBeenCalledTimes(1);
        expect(onOnly).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
    });

    it('should respect only() condition and onlyFuture', () => {
        const hub = new Hub();
        const future = jest.fn();
        const onOnly = jest.fn();
        const every = jest.fn();

        const onlyConditional = (payload: string) => {
            return payload === 'sandwich' || payload === 'pizza';
        }

        expect(future).toHaveBeenCalledTimes(0);
        expect(onOnly).toHaveBeenCalledTimes(0);
        expect(every).toHaveBeenCalledTimes(0);

        hub.pub('test', 'pizza');

        only(hub, 'test', future, onlyConditional, true);
        only(hub, 'test', onOnly, onlyConditional);
        hub.sub('test', every);

        hub.pub('test', 'burrito');
        hub.pub('test', 'sandwich');

        expect(every).toHaveBeenCalledTimes(2);
        expect(future).toHaveBeenCalledTimes(1);
        expect(future).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
        expect(onOnly).toHaveBeenCalledTimes(2);
        expect(onOnly).toHaveBeenCalledWith('pizza', expect.toHaveChannel('test'), expect.any(Function));
        expect(onOnly).toHaveBeenCalledWith('sandwich', expect.toHaveChannel('test'), expect.any(Function));
    });
});


