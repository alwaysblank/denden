export default class Message<Payload extends any = any> extends Event {
	static NAME = 'psmsg';
	constructor(public readonly channel: string, public readonly payload: Payload, public readonly timestamp: number) {
		super(Message.NAME, {bubbles: false});
	}

	static create<P>(channel: string, payload: P): Message<P> {
		return new Message(channel, payload, performance.now());
	}

	static sort(messages: Message[], order: 'ASC' | 'DESC'): Message[] {
		return messages.sort((a, b) => {
				switch (order) {
					case 'ASC':
						return a.timestamp - b.timestamp;
					case 'DESC':
						return b.timestamp - a.timestamp;
					default:
						return 0; // No reordering.
				}
			});
	}
}