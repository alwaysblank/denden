import Message, {PayloadGuard} from './message';

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
	sub(channel: string, callback: (payload: PayloadGuard) => void, backlog: number = 0) {
		const listener = (msg: Event) => {
			if (! (msg instanceof Message) || msg.channel !== channel) {
				return;
			}
			callback(msg.payload);
		}
		// -1 means "all messages" so anything less than that would be confusing.
		if (backlog < -1) {
			backlog = -1;
		}
		this.getMessages(channel, backlog).forEach(listener);
		this.addEventListener(Message.NAME, listener);
		return () => this.removeEventListener(Message.NAME, listener);
	}

	/**
	 * Publish a message to a particular channel.
	 */
	pub<Payload extends PayloadGuard = PayloadGuard>(channel: string, payload: Payload) {
		const msg = new Message(channel, payload);
		let i = this.#createChannel(channel);
		const messageIndex = this.#channels[i].messages.push(msg) - 1;
		this.dispatchEvent(this.#channels[i].messages[messageIndex]);
	}

	/**
	 * Watches the target for an event type, and funnels that into a channel.
	 */
	watch(channel: string, target: EventTarget, eventType: string, processor: (e: Event) => any) {
		const listener = (e: Event) => {
			this.pub(channel, processor(e));
		};
		target.addEventListener(eventType, listener);
		return () => target.removeEventListener(eventType, listener);
	}

	/**
	 * Get a set of
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
	#createChannel(channel: string, prepopulate: Message[] = []): number {
		const existing = this.#getChannelIndex(channel);
		if (existing > -1) {
			return existing;
		}
		return this.#channels.push({ name: channel, messages: prepopulate }) - 1;
	}
}