import Channel from "./channel";

export default class Message<Payload extends any = any> extends Event {
	static NAME = 'ddm';

	/**
	 * To create a message outside of this class, call `Message.create()` which will automatically set `timestamp` to an appropriate value.
	 *
	 * @param channel The channel on which this message is *originally* to be dispatched.
	 * @param payload Data carried by this message.
	 * @param timestamp An internal value used to sort messages in their order of creation. *Not* a representation of date-time.
	 * @private
	 */
	private constructor(public readonly channel: Channel<Payload>, public readonly payload: Payload, public readonly timestamp: number) {
		super(Message.NAME, {bubbles: false});
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