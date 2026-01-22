import Message from './message';
import Channel, {ChannelQuery} from './channel';
import {match, sortByProp} from "./tools";

export type ChannelRoute = string | RegExp;

export type CallbackResult = any|Promise<any>;

export type Callback<Payload> = (payload: Payload, message: Message<Payload>, unsub: (reason?: string) => void) => unknown;

export type WatchProcessor<Payload> = (event: Event) => Payload;

export type PubResult = {payload: unknown, results: Array<unknown>};

type HubQuery = {
	cid: ChannelRoute|ChannelRoute[],
} & ChannelQuery;

/**
 * Hub for sending and registering to receive messages.
 */
export default class Hub extends EventTarget {
	private channels: Map<string, Channel<any>> = new Map();
	private running: WeakMap<{payload: unknown}, Array<CallbackResult>> = new WeakMap();

	/**
	 * Listen to messages sent to a particular channel.
	 *
	 * Returns a method which, when called, will terminate the subscription;
	 * `callback` will not receive any further messages. Optionally, this
     * `unsub` method takes a string argument, indicating why we have
     * unsubscribed from this channel. (Currently, this is not accessible.)
	 *
	 * This method attempts to call `listener` for all historical messages
	 * in the order in which they were received, but it is theoretically
	 * possible to construct a circumstance in which messages might be
	 * received out of order. {@link Message#order} will always be greater
	 * for messages that have been dispatched more recently. However, it is
	 * a generally good practice for `listener` to be idempotent.
	 *
	 * @param {string} channel Name of the channel to subscribe to. Does not need to exist to be subscribed to. Passing `*` will subscribe to all channels.
	 * @param {function} callback Called with message payload and channel name when a message is published.
	 * @param {number} [backlog=0] Number of old messages in the channel(s) to send to listener before attaching subscription.
     * @param {AddEventListenerOptions} [listenerOptions={}] Options passed directly to `addEventListener()`. **Use with caution.**
	 */
	sub<Payload extends any = any>(channel: ChannelRoute, callback: Callback<Payload>, backlog: number = 0, listenerOptions: AddEventListenerOptions = {} ) {
        const controller = new AbortController();
		const listener = (msg: Event) => {
			if (msg instanceof Message && match(channel, msg.channel.name)) {
				 const result = callback(msg.payload, msg, (reason?: string) => controller.abort(reason));
				 this.addToRunning(
					 msg,
					 'undefined' === typeof result ? true : result
				 )
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

	private addToRunning(msg: Message, status: CallbackResult) {
		let current = this.running.get(msg.contains)
		if (!Array.isArray(current)) {
			current = [];
		}
		current.push(status);
		this.running.set(msg.contains, current);
	}

	/**
	 * Publish a message to a particular channel, or channels.
	 *
	 * @param routes Channel route (i.e., a channel name, wildcard string, or {@link RegExp}) to publish to, or an array of the same.
	 * 		Routes which are not fully-qualified (i.e., they are a wildcard string or a regular expression) will only
	 * 		dispatch to channels which are already registered on the {@link Hub}. Fully qualified route names for
	 * 		unregistered channels will result in the creation of a channel with that name.
	 * @param payload The item to dispatch to {@link routes}.
	 */
	pub<Payload>(routes: ChannelRoute|ChannelRoute[], payload: Payload) {
		return new Promise<Array<PubResult|Error>>((succeeded, failed) => {
			if (!Array.isArray(routes)) {
				routes = [routes];
			}
			const registeredChannels = this.getChannelsBy(routes);

			// For any fully qualified routes, create channels if they don't already exist.
			routes
				.filter((route): route is string => {
					return 'string' === typeof route && !route.includes('*') && !registeredChannels.has(route);
				})
				.forEach(name => {
					registeredChannels.add(this.channel(name).name);
				});

			const contains = {payload};
			registeredChannels.forEach(name => {
				const channel = this.channel<Payload>(name);
				channel.send(this, new Message<Payload>(channel, contains));
			});

			const running = this.running.get(contains);
			if (!Array.isArray(running)) {
				return succeeded([]);
			}

			Promise.allSettled(running).then(completed => {
				return completed.map(result => {
					switch (result.status) {
						case "fulfilled":
							return result.value;
						case 'rejected':
							return new Error(result.reason);
					}
				})
			}).then(succeeded, failed);
		});
	}

	/**
	 * Return the channel on this hub called `name`, or create one and return it if none exists.
	 *
	 * @param name Channel name.
	 */
	channel<Payload>(name: string): Channel<Payload> {
		if (this.channels.has(name)) {
			return this.channels.get(name) as Channel<Payload>;
		}
		const channel = new Channel<Payload>(name);
		this.channels.set(name, channel);

		return channel;
	}

	/**
     * Watch `target` for an event of `eventType`, and then broadcast it to `channel`.
     *
     * @param channel The name of the channel to dispatch to. Will be created if it doesn't exit.
     * @param target {@link EventTarget} to watch for events of {@link eventType}.
     * @param eventType Type of event to watch for on {@link target}.
     * @param [processor] Callback to convert events from {@link target} into the appropriate payload for {@link channel}. Defaults to simply returning the entire event object.
     */
	watch<Payload extends any = any>(channel: string, target: EventTarget, eventType: string, processor?: WatchProcessor<Payload>) {
		if ('function' !== typeof processor) {
			// Default to just passing along the event as-is.
			processor = (event) => event as Payload;
		}
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
	 * @param query - Set of query options for retrieving messages.
	 * @param query.cid - A argument (or array of arguments) which can resolve to channel names.
	 * @param [query.limit=1] - The number of messages to return.
	 * @param [query.order='DESC'] - Messages are sorted by order of dispatch: `ASC` is oldest -> newest, `DESC` is newest -> oldest.
	 *
	 * @return All messages from matching channel(s) which match {@link query}. The `Message.channel` property contains a reference to the {@link Channel} that an individual message came from.
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
					collection = sortByProp(collection.concat(msgs), 'order', order);
				}
				return collection;
			}, [] as Message[])

		return messages.slice(0, limit);
	}

	/**
	 * Return a Set of channels tracked by this Hub that match `channel`.
	 */
	private getChannelsBy(query: ChannelRoute|ChannelRoute[]): Set<string> {
		if ('*' === query) {
			return new Set(this.channels.keys());
		}
		if (!Array.isArray(query)) {
			query = [query];
		}
		const channels = new Set<string>();
		this.channels.keys().forEach(c => {
			if (match(query, c)) {
				channels.add(c);
			}
		});
		return channels;
	}
}