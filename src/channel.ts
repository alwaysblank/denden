import Message from './message';

export type ChannelQuery = {
	order?: 'ASC' | 'DESC';
	limit?: number;
}

export default class Channel<Payload extends any> {
	readonly name: string;
	#messages: Message<Payload>[];

	static channels: Map<string, any> = new Map();

	constructor(name: string, messages: Message<Payload>[] = []) {
		this.name = name;
		this.#messages = messages;

		Channel.channels.set(name, this);
	}

	/**
	 * Push `message` into the channel.
	 */
	receive(message: Message<Payload>): number {
		return this.#messages.push(message) - 1;
	}

	/**
	 * Push `message` into the channel and broadcast it to `hub`.
	 */
	broadcast(message: Message<Payload>, hub: EventTarget) {
		const i = this.receive(message);
		hub.dispatchEvent(message);
		return i;
	}

	/**
	 * Get some messages from the channel.
	 *
	 * @param order ASC (recent -> oldest) or DESC (oldest -> recent)
	 * @param limit Maximum number of messages to return, minimum 1. Default: 1
	 */
	query({order = 'DESC', limit}: ChannelQuery): Message[] {
		// No need for any calculation.
		if ('DESC' === order && 1 === limit) {
			return this.latest ? [this.latest] : [];
		}
		let messages = Message.sort(this.messages, order);
		if (limit) {
			messages = messages.slice(0, limit);
		}
		return messages;
	}

	get messages() {
		return [...this.#messages];
	}

	get latest() {
		return this.messages[this.#messages.length - 1];
	}

	/**
	 * Return a channel identified by `name`, creating such a channel if it doesn't exist.
	 */
	static get<Payload>(name: string) {
		if (Channel.channels.has(name)) {
			return Channel.channels.get(name) as Channel<Payload>; // Assume it has the correct payload.
		}

		return new Channel<Payload>(name);
	}
}