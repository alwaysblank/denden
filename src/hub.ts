import Message from './message';

export type ChannelRoute = string | RegExp;

export default class Hub extends EventTarget {
	#channels: Array<{name: string, messages: Message[]}> = [];

	/**
	 * Listen to messages sent to a particular channel.
	 *
	 * Returns a method which, when called, will terminate the subscription;
	 * `callback` will not receive any further messages.
	 *
	 * @param {string} channel Name of the channel to subscribe to. Does not need to exist to be subscribed to. Passing `*` will subscribe to all channels.
	 * @param {function} callback Called with message payload and channel name when a message is published.
	 * @param {number} [backlog=0] Number of old messages in channel to send to listener before attaching subscription. -1 is all messages.
	 */
	sub<Payload extends any = any>(channel: string|RegExp, callback: (payload: Payload, channel: string, unsub: () => void) => void, backlog: number = 0) {
		const listener = (msg: Event) => {
			if (!(msg instanceof Message) || !this.#matchChannel(channel, msg.channel)) {
				return;
			}
			callback(msg.payload, msg.channel, () => this.removeEventListener(Message.NAME, listener));
		}
		this.getMessages(channel, backlog).forEach(listener);
		this.addEventListener(Message.NAME, listener);
		return () => this.removeEventListener(Message.NAME, listener);
	}

	/**
	 * Publish a message to a particular channel.
	 */
	pub<Payload extends any = any>(channel: string, payload: Payload) {
		const msg = Message.create<Payload>(channel, payload);
		let i = this.#createChannel(channel);
		const messageIndex = this.#channels[i].messages.push(msg) - 1;
		this.dispatchEvent(this.#channels[i].messages[messageIndex]);
	}

	/**
	 * Watches the target for an event type, and funnels that into a channel.
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
	 * unless `count` is negative, in which case they are returned in
	 * chronological order.
	 *
	 * Passing `Infinity` to `count` will return all messages and is the default
	 * setting. `-Infinity` will return all messages in chronological order.
	 *
	 * Note that this returns `Message` objects (i.e. Events).
	 */
	getMessages(channel: ChannelRoute|ChannelRoute[], count: number = Infinity): Message[] {
		if (count === 0) {
			return [];
		}

		if (!Array.isArray(channel)) {
			const ids = this.#getChannelIds(channel);
			switch(ids.length) {
				case 0:
					return [];
				case 1: {
					const i = ids[0];
					return count < 0
						? this.#channels[i].messages.slice(0, -1 * count).reverse()
						: this.#channels[i].messages.slice(-1 * count).reverse();
				}
				default:
					return this.getMessages(
						ids.map( id => this.#getChannelName(id)).filter(name => 'string' === typeof name),
						count
					);
			}
		}
		const messages = channel.reduce((collection, route, i) => {
			const channels = this.#getChannelIds(route);
			if (channels.length > 0) {
				const messages = channels.reduce((msgs, id) => {
					const name = this.#getChannelName(id);
					if (name) {
						msgs = [...collection, ...this.getMessages(name, count)];
					}
					return msgs
				}, [] as Message[]);
				collection = [...collection, ...messages];
			}
			return collection;
		}, [] as Message[]);

		return messages.sort((a, b) => {
			return count < 0
				? a.timestamp - b.timestamp // recent -> oldest
				: b.timestamp - a.timestamp; // oldest -> recent
			})
			.slice(0, count);
	}

	/**
	 * Return the internal index of a channel.
	 */
	#getChannelIndex(channel: string) {
		return this.#channels.findIndex(({name}) => name === channel);
	}

	#getChannelName(id: number): undefined|string {
		return this.#channels[id]?.name;
	}

	/**
	 * Create a channel if one does not already exist. Returns the index of the new channel, or the existing channel.
	 *
	 * @param {string} channel The name of the channel
	 * @param {Message[]} [prepopulate=[]] Add messages to channel on creation. These will not trigger listeners.
	 */
	#createChannel<Payload extends any = any>(channel: string, prepopulate: Message<Payload>[] = []): number {
		const existing = this.#getChannelIndex(channel);
		if (existing > -1) {
			return existing;
		}
		return this.#channels.push({ name: channel, messages: prepopulate }) - 1;
	}

	/**
	 * Whether `match` can be a reference to `channel`.
	 */
	#matchChannel(match: ChannelRoute, channel: string): boolean {
		if ('*' === match) {
			return true;
		}

		if (match instanceof RegExp) {
			return match.test(channel);
		}

		if (!match.includes('*')) {
			return match === channel;
		}

		const hasPrefix = match.endsWith('*')
			? channel.startsWith(match.substring(0, match.length - 1))
			: true; // Empty prefix always passes.

		const hasSuffix = match.startsWith('*')
			? channel.endsWith(match.substring(1))
			: true; // Empty suffix always passes.

		return hasPrefix && hasSuffix;
	}

	/**
	 * Return all channels that can can be matched to `match`.
	 */
	#getChannelIds( match: ChannelRoute ): number[] {
		return this.#channels
			.reduce((collection, {name}, i) => {
				if (this.#matchChannel(match, name)) {
					collection.push(i);
				}
				return collection;
			}, [] as number[]);
	}
}