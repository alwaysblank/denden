import Message from './message';
import Channel, {ChannelQuery} from './channel';
import {sortByProp} from "./tools";

export type ChannelRoute = string | RegExp;

export default class Hub extends EventTarget {
	private channels: Map<string, Channel<any>> = new Map();

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
	sub<Payload extends any = any>(channel: ChannelRoute, callback: (payload: Payload, channel: Channel<Payload>, unsub: () => void) => void, backlog: number = 0) {
		const listener = (msg: Event) => {
			if (!(msg instanceof Message) || !this.#matchChannel(channel, msg.channel.name)) {
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
	pub<Payload extends any = any>(cid: string, ...payload: Payload[]) {
		let channel = this.channels.get(cid);
		if (!(channel instanceof Channel)) {
			channel = new Channel(cid);
			this.channels.set(cid, channel);
		}
		channel.send(this, ...payload.map(p => Message.create(channel, p)));
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
	 *
	 * @param {array} cid - A argument (or array of arguments) which can resolve to channel names.
	 * @param {Object} query - Set of query options for retrieving messages.
	 * @param {'ASC'|'DESC'} [query.order='DESC'] - Messages are sorted by order of dispatch: `ASC` is oldest -> newest, `DESC` is newest -> oldest.
	 *
	 * @return {Message[]} All messages from matching channel(s) which match the `query`. The `Message.channel` property contains a reference to the {@link Channel} that an individual message came from.
	 */
	getMessages(cid: ChannelRoute|ChannelRoute[], query: ChannelQuery = {}): Message[] {
		const {
			limit,
			order = 'DESC',
		} = query;

		if (limit === 0) {
			return [];
		}

		if (!Array.isArray(cid)) {
			cid = [cid];
		}

		// Compile deduplicated list of channels.
		const channels = Array.from(cid.reduce((collection, route) => {
			return collection.union(this.getChannels(route));
		}, new Set<string>()));

		const messages = channels.reduce((collection, channel) => {
			const msgs = this.channels.get(channel)?.messages;
			if (msgs) {
				collection = sortByProp('timestamp', collection.concat(msgs), order);
			}
			return collection;
		}, [] as Message[])

		if (!limit) {
			return messages;
		}

		return messages.slice(0, limit);
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
			return new Set(this.channels.keys());
		}
		const channels = new Set<string>();
		this.channels.keys().forEach(c => {
			if (this.#matchChannel(channel, c)) {
				channels.add(c);
			}
		});
		return channels;
	}
}