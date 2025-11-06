import Message from './message';
import {sortByProp} from './tools';

export type ChannelQuery = {
	order?: 'ASC' | 'DESC';
	limit?: number;
}

export default class Channel<Payload extends any> {
	#messages: Message<Payload>[] = [];

	constructor(public readonly name: string) {}

	/**
	 * Push `message` into the channel.
	 *
	 * @return {number} The index of this message in `this.messages`.
	 */
	receive(message: Message<Payload>): number {
		return this.#messages.push(message) - 1;
	}

	/**
	 * Push `message` into the channel and broadcast it to `hub`.
	 *
	 * @param {Message} message Data to be sent with the event.
	 * @param {EventTarget} hub Usually this will be a {@link Hub}.
	 *
	 * @return {number} The index of this message in `this.messages`.
	 */
	broadcast(message: Message<Payload>, hub: EventTarget): number {
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
		let messages = sortByProp('timestamp', this.messages, order);
		if (limit) {
			messages = messages.slice(0, limit);
		}
		return messages;
	}

	/**
	 * Returns an array of all {@link Message}s in this channel.
	 */
	get messages() {
		return [...this.#messages];
	}

	/**
	 * Returns an array of the payloads from all of this channel's {@link Message}s.
	 */
	get payloads() {
		return this.messages.map(message => message.payload);
	}
}