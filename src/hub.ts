import Message from './message';
import Channel, {ChannelQuery} from './channel';
import {match, sortByProp} from "./tools";

export type ChannelRoute = string | RegExp;

export type Callback<Payload> = (payload: Payload, message: Message<Payload>, unsub: (reason?: string) => void) => void;

type HubQuery = {
	cid: ChannelRoute|ChannelRoute[],
} & ChannelQuery;

/**
 * Hub for sending and registering to receive messages.
 */
export default class Hub extends EventTarget {
	private channels: Map<string, Channel<any>> = new Map();

	/**
	 * Listen to messages sent to a particular channel.
	 *
	 * Returns a method which, when called, will terminate the subscription;
	 * `callback` will not receive any further messages. Optionally, this
     * `usub` method takes a string argument, indicating why we have
     * unsubscribed from this channel. (Currently this is not accessible.)
	 *
	 * This method attempts to call `listener` for all historical messages
	 * in the order in which they were received, but it is theoretically
	 * possible to construct a circumstance in which messages might be
	 * received out of order. {@link Message#timestamp} will always be greater
	 * for messages that have been dispatched more recently. However, it is
	 * a generally good practice for `listener` to be idempotent.
	 *
	 * @param {string} channel Name of the channel to subscribe to. Does not need to exist to be subscribed to. Passing `*` will subscribe to all channels.
	 * @param {function} callback Called with message payload and channel name when a message is published.
	 * @param {number} [backlog=0] Number of old messages in channel to send to listener before attaching subscription.
     * @param {AddEventListenerOptions} [listenerOptions={}] Options passed directly to `addEventListener()`. **Use with caution.**
	 */
	sub<Payload extends any = any>(channel: ChannelRoute, callback: Callback<Payload>, backlog: number = 0, listenerOptions: AddEventListenerOptions = {} ) {
        const controller = new AbortController();
		const listener = (msg: Event) => {
			if (msg instanceof Message && match(channel, msg.channel.name)) {
				callback(msg.payload, msg, (reason?: string) => controller.abort(reason));
			}
		}
		this.addEventListener(Message.NAME, listener, {signal: controller.signal, ...listenerOptions});
        for (const m of this.query({cid: channel, order: 'DESC', limit: backlog})) {
            if (controller.signal.aborted) {
                break;
            }
            listener(m);
        }
		return (reason?: string) => controller.abort(reason);
	}

    /**
     * Run a callback once.
     *
     * @param {string} channel Name of the channel to subscribe to. Does not need to exist to be subscribed to. Passing `*` will subscribe to all channels.
     * @param {function} callback Called with message payload and channel name when a message is published.
     * @param {boolean} [onlyFuture=false] If `true`, `callback` will fire only for messages dispatched in the future. If `false`, messages in the backlog will also be considered.
     */
    once<Payload extends any>(channel: ChannelRoute, callback: Callback<Payload>, onlyFuture: boolean = false) {
        return this.sub<Payload>(channel, (payload, message, unsub) => {
            callback(payload, message, unsub);
            unsub('Called with once().');
        }, onlyFuture ? 0 : 1);
    }

    /**
     * Run callback only if `test` evaluates to `true`.
     */
    only<Payload extends any>(channel: ChannelRoute, callback: Callback<Payload>, test: (payload: Payload, message: Message<Payload>) => boolean, onlyFuture: boolean = false) {
        return this.sub<Payload>(channel, (payload, message, unsub) => {
            if (!test(payload, message)) {
                return;
            }
            callback(payload, message, unsub);
        }, onlyFuture ? 0 : 1);
    }

    /**
     * Remove subscription when `test` evaluates to `true`.
     */
    until<Payload extends any>(channel: ChannelRoute, callback: Callback<Payload>, test: (payload: Payload, message: Message<Payload>) => boolean, onlyFuture: boolean = false) {
        return this.sub(channel, (payload, message, unsub) => {
            if (test(payload, message)) {
                unsub('Met until() condition.');
                return;
            }
            callback(payload, message, unsub);
        }, onlyFuture ? 0 : 1);
    }

	/**
	 * Publish a message to a particular channel.
	 */
	pub<Payload extends any = any>(cid: string, ...payload: Payload[]) {
		let channel = this.channels.get(cid);
		if (!(channel instanceof Channel)) {
			channel = new Channel(cid);
			this.channels.set(cid, channel);
		}
		channel.send(this, ...payload.map(p => Message.create(channel, p)));
	}

	/**
	 * Watch `target` for an event of `eventType`, and then broadcast it to `channel`.
	 */
	watch<Payload extends any = any>(channel: string, target: EventTarget, eventType: string, processor: (e: Event) => Payload) {
		const listener = (e: Event) => {
			this.pub<Payload>(channel, processor(e));
		};
		target.addEventListener(eventType, listener);
		return () => target.removeEventListener(eventType, listener);
	}

	/**
	 * Get a set of messages that were already sent to the channel.
	 *
	 * Messages are returned in reverse chronological order (most recent -> oldest),
	 *
	 * @param {Object} query - Set of query options for retrieving messages.
	 * @param {array} query.cid - A argument (or array of arguments) which can resolve to channel names.
	 * @param {number} [query.limit=1] - The number of messages to return.
	 * @param {'ASC'|'DESC'} [query.order='DESC'] - Messages are sorted by order of dispatch: `ASC` is oldest -> newest, `DESC` is newest -> oldest.
	 *
	 * @return {Message[]} All messages from matching channel(s) which match the `query`. The `Message.channel` property contains a reference to the {@link Channel} that an individual message came from.
	 */
	query(query: HubQuery): Message[] {
		const {
			cid,
			limit = 1,
			order = 'DESC',
		} = query;

		if ('undefined' === typeof cid) {
			return [];
		}

		if (limit === 0) {
			// This will never result in returning any messages, so save some time.
			return [];
		}

		const routes = Array.isArray(cid) ? cid : [cid];

		const messages = Array.from(routes.reduce((collection, route) => {
			return collection.union(this.getChannelsBy(route));
		}, new Set<string>()))
			.reduce((collection, channel) => {
				const msgs = this.channels.get(channel)?.messages;
				if (msgs) {
					collection = sortByProp(collection.concat(msgs), 'timestamp', order);
				}
				return collection;
			}, [] as Message[])

		return messages.slice(0, limit);
	}

	/**
	 * Return a Set of channels tracked by this Hub that match `channel`.
	 */
	private getChannelsBy(channel: ChannelRoute): Set<string> {
		if ('*' === channel) {
			return new Set(this.channels.keys());
		}
		const channels = new Set<string>();
		this.channels.keys().forEach(c => {
			if (match(channel, c)) {
				channels.add(c);
			}
		});
		return channels;
	}
}