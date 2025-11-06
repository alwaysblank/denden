import Channel from "./channel";

/**
 * An Event carrying some kind of data.
 */
export default class Message<Payload extends any = any> extends Event {
	static NAME = 'ddm';

	/**
	 * A value used to order messages by dispatch time.
	 *
	 * This value is *not* a date/time value and should be used only for
	 * ordering purposes.
	 *
	 * Strictly speaking, it is set on Message creation, not on Message
	 * dispatch, but when using the methods {@link Hub.pub} or {@link Hub.watch}
	 * Messages are created at the time of dispatch.
	 */
	public readonly timestamp: number;

	/**
	 * The payload being carried by this Message; can be any kind of data.
	 */
	public readonly payload: Payload;

	/**
	 * The {@link Channel} on which this Message was originally dispatched.
	 *
	 * This can be relevant because in some situations (i.e. when calling
	 * {@link Hub.query} or {@link Hub.sub}) Messages can be returned from
	 * across several channels.
	 */
	public readonly channel: Channel<Payload>;

	/**
	 * To create a message outside of this class, call `Message.create()` which will automatically set `timestamp` to an appropriate value.
	 *
	 * @param channel The channel on which this message is *originally* to be dispatched.
	 * @param payload Data carried by this message.
	 * @param timestamp An internal value used to sort messages in their order of creation. *Not* a representation of date-time.
	 * @private
	 */
	private constructor(channel: Channel<Payload>, payload: Payload, timestamp: number) {
		super(Message.NAME, {bubbles: false});
		this.timestamp = timestamp;
		this.channel = channel;
		this.payload = payload;
	}

	static create<P>(channel: Channel<P>, payload: P): Message<P> {
		return new Message(channel, payload, performance.now());
	}

	toJSON() {
		return {
			channel: this.channel.name,
			payload: this.payload,
		}
	}
}