export default class Message<Payload extends any = any> extends Event {
	static NAME = 'psmsg';
	constructor(public readonly channel: string, public readonly payload: Payload) {
		super(Message.NAME, {bubbles: false});
	}
}