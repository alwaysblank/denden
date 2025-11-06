import Message from './message';
import {sortByProp} from './tools';

export type ChannelQuery = {
	order?: 'ASC' | 'DESC';
	limit?: number;
}

export default class Channel<Payload extends any> {
	readonly name: string;
	#messages: Message<Payload>[];

	constructor(name: string, messages: Message<Payload>[] = []) {
		this.name = name;
		this.#messages = messages;
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
		let messages = Message.sort(this.messages, order);
		if (limit) {
			messages = messages.slice(0, limit);
		}
		return messages;
	}

	merge(...channels: Channel<Payload>[], order: Required<ChannelQuery['order']>) {
		const messages = channels.reduce((msgs, {messages}) => {
			return sortByProp('timestamp', messages.concat(messages), order);
		}, this.messages);
	}

	get messages() {
		return [...this.#messages];
	}

}