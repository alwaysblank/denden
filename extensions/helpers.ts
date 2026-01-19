import type Message from "../src/message";
import type Hub from "../src/hub";
import type { Callback, ChannelRoute } from "../src/hub";

/**
 * Run callback only if `test` evaluates to `true`.
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
 * Remove subscription when `test` evaluates to `true`.
 */
function until<Payload extends any>(hub: Hub, channel: ChannelRoute, callback: Callback<Payload>, test: (payload: Payload, message: Message<Payload>) => boolean, onlyFuture: boolean = false) {
    return hub.sub(channel, (payload, message, unsub) => {
        if (test(payload, message)) {
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