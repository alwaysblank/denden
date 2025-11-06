import Message from './message';
import {sortByProp} from './tools';

export type ChannelQuery = {
	order?: 'ASC' | 'DESC';
	limit?: number;
}

type SendValue = Message|number;

export default class Channel<Payload extends any> {
	#messages: Message<Payload>[] = [];

	constructor(public readonly name: string) {}

	/**
	 * Push `message` into the channel.
	 *
	 * @return {number[]} Array of the indexes of all messages inserted, in order of insertion.
	 */
	put(...message: Message<Payload>[]): number[] {
		return message.map(msg => this.#messages.push(msg) - 1);
	}

	/**
	 * Push `message` into the channel and broadcast it to `hub`.
	 *
	 * @param {EventTarget} hub Usually this will be a {@link Hub}.
	 * @param {Message|number} message The {@link Message} to be sent, or the index of a Message already in the Channel to be sent.
	 *
	 * @return {number[]} Array of the indexes of all messages dispatched, in order of dispatch. A value of `-1` means the Message did not exist.
	 */
	send(hub: EventTarget, ...message: SendValue[]): number[] {
		return message.map(msg => {
			if ('number' === typeof msg) {
				if (!(this.#messages[msg] instanceof Message)) {
					return -1;
				}
				msg = this.#messages[msg];
			}
			const [i] = this.put(msg);
			hub.dispatchEvent(msg);
			return i;
		})
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
}