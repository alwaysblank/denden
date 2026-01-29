import {Hub, Message} from '../core';
import type {Callback, ChannelRoute} from "../core";

/**
 * Run callback only if `test` evaluates to `true`.
 *
 * @param hub The hub this listener should attach to.
 * @param channel The channel to subscribe to.
 * @param callback Called with the payload, message, and unsub function when a message is published.
 * @param test Function that determines if the callback should be invoked.
 * @param [onlyFuture=false] If `true`, `callback` will fire only for messages dispatched in the future. If `false`, messages in the backlog will also be considered.
 *
 * @example
 * const hub = new Hub();
 *
 * only(hub, 'sandwiches', (p) => console.log(`only: ${p}`), (p) => p.includes('reuben'));
 *
 * hub.pub('sandwiches', 'reuben sandwich');
 * // "only: reuben sandwich"
 * hub.pub('sandwiches', 'chicken sandwich');
 * // Nothing printed.
 */
function only<Payload extends any>(hub: Hub, channel: ChannelRoute, callback: Callback<Payload>, test: (payload: Payload, message: Message<Payload>) => boolean, onlyFuture: boolean = false) {
    return hub.sub<Payload>(channel, (payload, message, unsub) => {
        if (!test(payload, message)) {
            return;
        }
        callback(payload, message, unsub);
    }, onlyFuture ? 0 : 1);
}


/**
 * Remove subscription when {@link test} evaluates to `true`.
 *
 * @param hub The hub this listener should attach to.
 * @param channel The channel to subscribe to.
 * @param callback Called with the payload, message, and unsub function when a message is published.
 * @param test Function that determines if the subscription should be removed.
 * @param [includeMatch=true] If `true`, the payload that matches {@link test} will be sent to {@link callback}; if `false`, then the listener will be removed without invoking the callback.
 * @param [onlyFuture=false] If `true`, `callback` will fire only for messages dispatched in the future. If `false`, messages in the backlog will also be considered.
 *
 * @example
 * const hub = new Hub();
 *
 * until(hub, 'sandwiches', (p) => console.log(`until: ${p}`), (p) => p.includes('reuben'));
 *
 * hub.pub('sandwiches', 'club sandwich');
 * // "until: club sandwich"
 * hub.pub('sandwiches', 'reuben sandwich');
 * // "until: reuben sandwich"
 * hub.pub('sandwiches', 'chicken sandwich');
 * // Nothing printed.
 */
function until<Payload extends any>(hub: Hub, channel: ChannelRoute, callback: Callback<Payload>, test: (payload: Payload, message: Message<Payload>) => boolean, includeMatch: boolean = true, onlyFuture: boolean = false) {
    return hub.sub(channel, (payload, message, unsub) => {
        if (test(payload, message)) {
			if (includeMatch) {
				callback(payload, message, unsub);
			}
            unsub('Met until() condition.');
            return;
        }
        callback(payload, message, unsub);
    }, onlyFuture ? 0 : 1);
}

/**
 * Run a callback once.
 *
 * @param hub The hub this listener should attach to.
 * @param channel Name of the channel to subscribe to. Does not need to exist to be subscribed to. Passing `*` will subscribe to all channels.
 * @param callback Called with message payload and channel name when a message is published.
 * @param [onlyFuture=false] If `true`, `callback` will fire only for messages dispatched in the future. If `false`, messages in the backlog will also be considered.
 *
 * @example
 * const hub = new Hub();
 *
 * once(hub, 'sandwiches', (p) => console.log(`once: ${p}`));
 *
 * hub.pub('sandwiches', 'reuben sandwich');
 * // "once: reuben sandwich"
 * hub.pub('sandwiches', 'chicken sandwich');
 * // Nothing printed.
 */
function once<Payload extends any>(hub: Hub, channel: ChannelRoute, callback: Callback<Payload>, onlyFuture: boolean = false) {
    return hub.sub<Payload>(channel, (payload, message, unsub) => {
        callback(payload, message, unsub);
        unsub('Called with once().');
    }, onlyFuture ? 0 : 1);
}

export {
    only,
    until,
    once,
}