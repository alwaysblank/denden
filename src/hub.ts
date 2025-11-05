import Message from './message';
import Channel, {ChannelQuery} from './channel';

export type ChannelRoute = string | RegExp;

export default class Hub extends EventTarget {
	#channels: Set<string> = new Set(); // Set of channel names used by this hub.

	/**
	 * Listen to messages sent to a particular channel.
	 *
	 * Returns a method which, when called, will terminate the subscription;
	 * `callback` will not receive any further messages.
	 *
	 * @param {string} channel Name of the channel to subscribe to. Does not need to exist to be subscribed to. Passing `*` will subscribe to all channels.
	 * @param {function} callback Called with message payload and channel name when a message is published.
	 * @param {number} [backlog=0] Number of old messages in channel to send to listener before attaching subscription.
	 */
	sub<Payload extends any = any>(channel: string|RegExp, callback: (payload: Payload, channel: string, unsub: () => void) => void, backlog: number = 0) {
		const listener = (msg: Event) => {
			if (!(msg instanceof Message) || !this.#matchChannel(channel, msg.channel)) {
				return;
			}
			callback(msg.payload, msg.channel, () => this.removeEventListener(Message.NAME, listener));
		}
		this.getMessages(channel, {order: 'DESC', limit: backlog}).forEach(listener);
		this.addEventListener(Message.NAME, listener);
		return () => this.removeEventListener(Message.NAME, listener);
	}

	/**
	 * Publish a message to a particular channel.
	 */
	pub<Payload extends any = any>(channelName: string, payload: Payload) {
		this.#channels.add(channelName); // Make sure we are tracking this channel.
		const msg = Message.create<Payload>(channelName, payload);
		const channel = Channel.get<Payload>(channelName);
		channel.broadcast(msg, this);
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
	getMessages(channel: ChannelRoute|ChannelRoute[], query: ChannelQuery = {}): Message[] {
		const {
			limit,
			order = 'DESC',
		} = query;

		if (limit === 0) {
			return [];
		}

		if (!Array.isArray(channel)) {
			channel = [channel];
		}

		const channels = channel.reduce((col, c) => {
			return col.union(this.getChannels(c));
		}, new Set<string>());

		let messages: Message[] = [];
		channels.forEach(channel => {
			messages = [...messages, ...Channel.get(channel).query({order, limit})];
		});

		messages = Message.sort(messages, order);

		if (limit) {
			messages = messages.slice(0, limit);
		}

		return messages;
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
	 * Return a Set of channels tracked by this Hub that match `channel`.
	 */
	getChannels(channel: ChannelRoute): Set<string> {
		if ('*' === channel) {
			return new Set(...this.#channels);
		}
		const channels = new Set<string>();
		this.#channels.forEach(c => {
			if (this.#matchChannel(channel, c)) {
				channels.add(c);
			}
		});
		return channels;
	}
}