import Message from './message';
import {sortByProp} from './tools';

/**
 * A query against a {@link Channel} to return messages which meet the qualifications of the query.
 */
export type ChannelQuery = {
	order?: 'ASC' | 'DESC';
	limit?: number;
}

/**
 * Represents an argument describing a message to send.
 * If a {@link Message}, it is the literal message to send.
 * If a {@link number}, it is the index in the {@link Channel}'s message archive of the message to send.
 */
type SendValue = Message|number;

/**
 * Collect and handle {@link Message}s.
 */
export default class Channel<Payload> {
	#messages: Message<Payload>[] = [];

	/**
	 * The name by which this Channel is identified.
	 *
	 * Sometimes also referred to as `cid` ("Channel ID").
	 *
	 * @see Hub.sub
	 * @see Hub.pub
	 * @see Hub.query
	 */
	public readonly name: string;

	constructor(name: string) {
		if (name.includes('*')) {
			throw new Error(`Invalid channel '${name}'; Channel names cannot contain '*'.`);
		}
		this.name = name;
	}

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
	 * @param {...Message|number} message The {@link Message} to be sent, or the index of a Message already in the Channel to be sent. Messages and indices can be interleaved.
	 *
	 * @return {number[]} Array of the indexes of all messages dispatched, in order of dispatch. A value of `-1` means the Message did not exist.
	 */
	send(hub: EventTarget, ...message: SendValue[]): number[] {
		return message.map(msg => {
            let i = -1;
			if ('number' === typeof msg) {
				if (!(this.#messages[msg] instanceof Message)) {
                    return i;
				}
                i = msg;
				msg = this.#messages[msg];
			} else {
                [i] = this.put(msg);
            }
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
		let messages = sortByProp(this.messages, 'order', order);
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