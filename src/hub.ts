import Message from './message';

export default class Hub extends EventTarget {
	#channels: Array<{name: string, messages: Message[]}> = [];

	/**
	 * Listen to messages sent to a particular channel.
	 *
	 * If `provideLast` is true, then the last message for the channel (if any)
	 * will be sent to `callback` before the listener is attached.
	 *
	 * @param {string} channel Name of the channel to subscribe to. Does not need to exist.
	 * @param {function} callback Called with message payload when a message is published.
	 * @param {number} [backlog=0] Number of old messages in channel to send to listener before attaching subscription. -1 is all messages.
	 */
	sub<Payload extends any = any>(channel: string, callback: (payload: Payload) => void, backlog: number = 0) {
		const listener = (msg: Event) => {
			if (! (msg instanceof Message) || msg.channel !== channel) {
				return;
			}
			callback(msg.payload);
		}
		this.getMessages(channel, backlog).forEach(listener);
		this.addEventListener(Message.NAME, listener);
		return () => this.removeEventListener(Message.NAME, listener);
	}

	/**
	 * Publish a message to a particular channel.
	 */
	pub<Payload extends any = any>(channel: string, payload: Payload) {
		const msg = new Message(channel, payload);
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
	getMessages(channel: string, count: number = Infinity) {
		if (count === 0) {
			return [];
		}
		const i = this.#getChannelIndex(channel);
		if (i === -1) {
			return [];
		}
		if (Math.abs(count) === Infinity) {
			const messages = [...this.#channels[i].messages];
			return count < 0 ? messages : messages.reverse();
		}
		return count < 0
			? this.#channels[i].messages.slice(0, -1 * count).reverse()
			: this.#channels[i].messages.slice(-1 * count).reverse();
	}

	/**
	 * Return the internal index of a channel.
	 */
	#getChannelIndex(channel: string) {
		return this.#channels.findIndex(({name}) => name === channel);
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
}