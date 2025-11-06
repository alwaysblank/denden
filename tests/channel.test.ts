import Channel from '../src/channel';
import Message from '../src/message';

test('Respect query() parameters', () => {
	const channel = new Channel('test');
	channel.put(Message.create(channel, 'sent first'));
	channel.put(Message.create(channel, 'sent second'));
	channel.put(Message.create(channel, 'sent third'));

	expect(channel.query({ order: 'ASC' }).map(msg => msg.payload)).toEqual(['sent first', 'sent second', 'sent third']);
	expect(channel.query({ order: 'ASC', limit: undefined }).map(msg => msg.payload)).toEqual(['sent first', 'sent second', 'sent third']);
	expect(channel.query({ order: 'ASC', limit: 2 }).map(msg => msg.payload)).toEqual(['sent first', 'sent second']);
	expect(channel.query({ order: 'DESC' }).map(msg => msg.payload)).toEqual(['sent third', 'sent second', 'sent first']);
	expect(channel.query({ order: 'DESC', limit: 2 }).map(msg => msg.payload)).toEqual(['sent third', 'sent second']);
});
