/**
 * An Event carrying some kind of data.
 */
export default class Message<Payload extends any = any> extends Event {
	static NAME = 'ddm::event::message';
	static #order: number = 0;

	/**
	 * A value used to order messages.
	 *
	 * Strictly speaking, it is set on Message creation, not on Message
	 * dispatch, but when using the methods {@link hub!default.pub Hub.pub()} or {@link hub!default.watch Hub.watch()}
	 * Messages are created at the time of dispatch.
	 */
	public readonly order: number;

	/**
	 * An object containing the payload.
	 *
	 * Generally you don't want to access this; you want to access {@link payload}.
	 * This is an object because we want to be able to use it as a unique
	 * identifier for Messages. Different messages would have the same scalar
	 * payload but be meaningfully distinct. Object equality in JS, however,
	 * means that ever object can be distinct, even if the actual payloads are
	 * the same.
	 */
	public readonly contains: {payload: Payload};

	/**
	 * The {@link Channel} on which this Message was originally dispatched.
	 *
	 * This can be relevant because in some situations (i.e. when calling
	 * {@link hub!default.getMessages Hub.getMessages()} or {@link hub!default.sub Hub.sub()}) Messages can be returned from
	 * across several channels.
	 */
	public readonly channel: string;

	/**
	 * If manually creating a message outside of a Hub, using {@link Message.create} is easier to use.
	 *
	 * The constructor allows you to directly specify the {@link Message.contains}
	 * object, which may be useful if creating multiple Messages across different
	 * {@link !hub.Channel Channels} with the same payload.
	 *
	 * @param channel The {@link Channel} on which this message is *originally* to be dispatched.
	 * @param payload Object containing the payload.
	 */
	constructor(channel: string, payload: {payload: Payload}) {
		super(Message.NAME, {bubbles: false});
		this.order = Message.#order++;
		this.channel = channel;
		this.contains = payload;
	}

	/**
	 * The data being carried by this message.
	 */
	get payload(): Payload {
		return this.contains.payload;
	}

	/**
	 * Create a new Message.
	 *
	 * @param channel The {@link Channel} on which this message is *originally* to be dispatched.
	 * @param payload The data being carried by this message.
	 */
	static create<Payload extends any>(channel: string, payload: Payload): Message<Payload> {
		return new Message(channel, {payload});
	}

	/**
	 * Specify how this class should be converted to a JSON object.
	 */
	toJSON() {
		return {
			channel: this.channel,
			payload: this.payload,
			order: this.order,
		}
	}
}