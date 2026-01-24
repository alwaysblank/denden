import Message from './message';
import {match, sortByProp} from "./tools";

export type ChannelRoute = string | RegExp;

/**
 * Describes a channel on the {@link Hub}.
 *
 * The `name` property is not writeable.
 */
export type Channel = Array<Message> & {name: string};

/**
 * The value returned by a callback passed to {@link Hub.sub}.
 *
 * Essentially this is just to say "it can be anything, or a Promise that
 * returns anything" so that consuming logic can handle both cases.
 */
export type CallbackResult = any|Promise<any>;

/**
 * A callback passed to {@link Hub.sub}.
 *
 * @param payload The payload of the message being processed.
 * @param message The message being processed.
 * @param unsub A function which, when called, will terminate the subscription.
 */
export type Callback<Payload> = (payload: Payload, message: Message<Payload>, unsub: (reason?: string) => void) => unknown;

/**
 * Callback to {@link Hub.watch} to convert an event to a payload suitable for dispatch to a channel.
 */
export type WatchProcessor<Payload> = (event: Event) => Payload;

/**
 * The value returns by the {@link Hub.pub} Promise.
 *
 * @property payload The payload of the message(s) that were published. All callbacks processed this same payload.
 * @property results The results of any callbacks that were invoked when publishing the message(s).
 */
export type PubResult = {payload: unknown, results: Array<unknown>};

/**
 * Describes a query to {@link Hub.getMessages} for messages.
 *
 * @property cid - A argument (or array of arguments) which can resolve to channel names.
 * @property [limit=1] - The number of messages to return.
 * @property [order='DESC'] - Messages are sorted by order of dispatch: `ASC` is oldest -> newest, `DESC` is newest -> oldest.
 */
export type MessageQuery = {
	cid: ChannelRoute|ChannelRoute[],
	order?: 'ASC' | 'DESC';
	limit?: number;
};

/**
 * Hub for sending and registering to receive messages.
 */
export default class Hub extends EventTarget {
	private channels: Map<string, Channel> = new Map();
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
	 * received out of order. {@link message!default.order Message.order} will always be greater
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
			if (msg instanceof Message && match(channel, msg.channel)) {
				this.handleCallback<Payload>(callback, msg, controller);
			}
		}
		this.addEventListener(Message.NAME, listener, {signal: controller.signal, ...listenerOptions});
        for (const m of this.getMessages({cid: channel, order: 'DESC', limit: backlog})) {
            if (controller.signal.aborted) {
                break;
            }
            listener(m);
        }
		return (reason?: string) => controller.abort(reason);
	}

	/**
	 * Publish a message to a particular channel, or channels.
	 *
	 * Returns a Promise which resolves when all callbacks attached to
	 * {@link routes} have completed. If a callback thr
	 *
	 * Callbacks which returned `void` or `undefined` will have the value `true`.
	 *
	 * @param routes Channel route (i.e., a channel name, wildcard string, or RegExp) to publish to, or an array of the same.
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
			const fullyQualifiedChannels = this.getChannels(routes);

			// For any fully qualified routes, create channels if they don't already exist.
			for (const route of routes) {
				if('string' === typeof route && !route.includes('*') && !fullyQualifiedChannels.has(route)) {
					fullyQualifiedChannels.add(this.channel(route).name);
				}
			}

			const contains = {payload};
			fullyQualifiedChannels.forEach(name => {
				this.channel<Payload>(name)
					.push(new Message<Payload>(name, contains));
				return;
			});

			const running = this.running.get(contains) ?? [];
			if (running.length === 0) {
				// This is a valid case; it means we dispatched a message that nothing is subscribed to.
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
			})
				.then(succeeded, failed)
				.finally(() => {
					this.running.delete(contains)
				});
		});
	}

	/**
     * Watch an event emitter and retransmit events to a channel.
     *
     * @param channel The name of the channel to dispatch to. Will be created if it doesn't exit.
     * @param target EventTarget to watch for events of {@link eventType}.
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
	 * Get a set of {@link message!default Messages} that were already sent to the channel.
	 *
	 * Messages are returned in reverse chronological order (most recent -> oldest),
	 *
	 * @param query - Set of query options for retrieving messages.
	 * @param query.cid - A argument (or array of arguments) which can resolve to channel names.
	 * @param [query.limit=1] - The number of messages to return.
	 * @param [query.order='DESC'] - Messages are sorted by order of dispatch: `ASC` is oldest -> newest, `DESC` is newest -> oldest.
	 *
	 * @return All messages from matching channel(s) which match {@link query}.
	 */
	getMessages(query: MessageQuery): Message[] {
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
			return collection.union(this.getChannels(route));
		}, new Set<string>()))
			.reduce((collection, channel) => {
				const msgs = this.channels.get(channel);
				if (msgs) {
					collection = sortByProp(collection.concat(msgs), 'order', order);
				}
				return collection;
			}, [] as Message[])

		return messages.slice(0, limit);
	}

	/**
	 * Return a Set of channels tracked by this Hub that match {@link query}.
	 */
	getChannels(query: ChannelRoute|ChannelRoute[]): Set<string> {
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

	/**
	 * Create a channel named {@link name}.
	 *
	 * If such a channel already exists, this method will return the name of the existing channel.
	 */
	makeChannel(name: string) {
		return this.channel(name).name;
	}

	/**
	 * Return the channel on this hub called {@link name}, or create one and return it if none exists.
	 */
	private channel<Payload>(name: string) {
		const existing = this.channels.get(name);
		if (existing) {
			return existing;
		}
		const self = this;
		const messages: Message<Payload>[] = [];
		const channel = new Proxy(messages, {
			set(channel, index, message) {
				if ('string' === typeof index && Number.isInteger(parseInt(index))) {
					if (!(message instanceof Message)) {
						throw new Error('Channels can only contain Messages.', message);
					}
					self.dispatchEvent(message);
				}
				return Reflect.set(channel, index, message);
			},
			get(channel, property) {
				if ('name' === property) {
					return name;
				}
				return Reflect.get(channel, property);
			},
		}) as Channel;
		this.channels.set(name, channel);

		return channel;
	}

	/**
	 * Add a {@link status callback result} to the list of results for a given {@link msg message}.
	 *
	 * @param msg The message this callback is processing.
	 * @param status Value returned by the callback; may be a Promise.
	 */
	private addToRunning(msg: Message, status: CallbackResult) {
		let current = this.running.get(msg.contains)
		if (!Array.isArray(current)) {
			current = [];
		}
		current.push(status);
		this.running.set(msg.contains, current);
	}

	/**
	 * Handle running the callback for {@link sub}.
	 */
	private handleCallback<Payload>(callback: Callback<Payload>, message: Message<Payload>, controller: AbortController) {
		let result: CallbackResult;
		try {
			result = callback(message.payload, message, (reason?: string) => controller.abort(reason));
		} catch (e) {
			result = new CallbackError(e);
			if (e instanceof Error) {
				this.dispatchEvent(new ErrorEvent(result));
			} else {
				this.dispatchEvent(new ErrorEvent(new Error(
					'Caught a non-Error error',
					{cause: result}
				)));
			}
		}
		this.addToRunning(
			message,
			'undefined' === typeof result ? true : result
		)
	}
}

/**
 * Wraps an error thrown by a callback passed to {@link Hub.sub} so that we can differentiate from an error that a callback returns.
 */
export class CallbackError extends Error {
	static NAME = 'ddm::error::callback';
	constructor(e: unknown) {
		super(CallbackError.NAME, {cause: e});
	}
}

/**
 * Event dispatched when the {@link Hub} encounters an error so that we can react to errors without them blocking execution.
 *
 * Most notably, this is used when a callback passed to {@link Hub.sub} throws an error.
 */
export class ErrorEvent extends Event {
	static NAME = 'ddm::event::error';
	public readonly cause: Error;
	constructor(error: Error) {
		super(ErrorEvent.NAME);
		this.cause = error;
	}
}