import Message, {PayloadGuard} from './message';

export default class Hub extends EventTarget {
	#channels: Array<{name: string, messages: Message[]}> = [];

	/**
	 * Listen to messages sent to a particular channel.
	 *
	 * If `provideLast` is true, then the last message for the channel (if any)
	 * will be sent to `callback` before the listener is attached.
	 */
	sub(channel: string, callback: (payload: PayloadGuard) => void, provideLast = false) {
		const listener = (msg: Event) => {
			if (! (msg instanceof Message) || msg.channel !== channel) {
				return;
			}
			callback(msg.payload);
		}
		if (provideLast) {
			const lastMessage = this.getLastMessage(channel);
			if ('undefined' !== typeof lastMessage) {
				listener(lastMessage);
			}
		}
		this.addEventListener(Message.NAME, listener);
		return () => this.removeEventListener(Message.NAME, listener);
	}

	/**
	 * Publish a message to a particular channel.
	 */
	pub<Payload extends PayloadGuard = PayloadGuard>(channel: string, payload: Payload) {
		const msg = new Message(channel, payload);
		let channelIndex = this.#getChannelIndex(channel);
		if (channelIndex === -1) {
			channelIndex = this.#channels.push({ name: channel, messages: [] }) - 1;
		}
		const messageIndex = this.#channels[channelIndex].messages.push(msg) - 1;
		this.dispatchEvent(this.#channels[channelIndex].messages[messageIndex]);
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
	 * Get all messages for a channel, with the most recent first.
	 */
	getMessages(channel: string) {
		const i = this.#getChannelIndex(channel);
		if (i === -1) {
			return [];
		}
		const messages = this.#channels[i].messages;
		return messages.reverse();
	}

	/**
	 * Returns the last message, if any, sent to a particular channel.
	 */
	getLastMessage(channel: string) {
		const i = this.#getChannelIndex(channel);
		if (i === -1) {
			return undefined;
		}
		return this.#channels[i].messages[this.#channels[i].messages.length - 1];
	}

	/**
	 * Return the internal index of a channel.
	 */
	#getChannelIndex(channel: string) {
		return this.#channels.findIndex(({name}) => name === channel);
	}
}