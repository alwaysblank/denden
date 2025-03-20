export type PayloadGuard = number|string|object;

export default class Message<Payload extends PayloadGuard = PayloadGuard> extends Event {
	static NAME = 'psmsg';
	constructor(public readonly channel: string, public readonly payload: Payload) {
		super(Message.NAME, {bubbles: false});
	}
}