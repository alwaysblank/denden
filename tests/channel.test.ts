import Channel from '../src/channel';
import Message from '../src/message';

beforeEach(() => {
	Channel.channels.clear(); // We don't want to track Channels between tests.
});

test('Respect query() parameters', () => {
	const channel = Channel.get('test');
	channel.receive(Message.create(channel.name, 'sent first'));
	channel.receive(Message.create(channel.name, 'sent second'));
	channel.receive(Message.create(channel.name, 'sent third'));

	expect(channel.query({ order: 'ASC' }).map(msg => msg.payload)).toEqual(['sent first', 'sent second', 'sent third']);
	expect(channel.query({ order: 'ASC', limit: undefined }).map(msg => msg.payload)).toEqual(['sent first', 'sent second', 'sent third']);
	expect(channel.query({ order: 'ASC', limit: 2 }).map(msg => msg.payload)).toEqual(['sent first', 'sent second']);
	expect(channel.query({ order: 'DESC' }).map(msg => msg.payload)).toEqual(['sent third', 'sent second', 'sent first']);
	expect(channel.query({ order: 'DESC', limit: 2 }).map(msg => msg.payload)).toEqual(['sent third', 'sent second']);
});
