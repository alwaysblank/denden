import Channel from '../src/channel';
import Message from '../src/message';

afterEach(() => {
    jest.restoreAllMocks();
});

describe('Creating channels', () => {
   it.each([
       '*',
       '*wich',
       'sand*',
   ])( 'should reject names that contain an asterisk: %s', (name) => {
       expect(() => new Channel(name)).toThrow();
   });
});

describe('Querying Messages', () => {
    it('should respect query() parameters', () => {
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
})

describe('Sending Messages', () => {
    it('should dispatch a message to the eventTarget', () => {
        const target = new EventTarget();
        const dispatch = jest.spyOn(target, 'dispatchEvent');
        const channel = new Channel('test');
        const msg = Message.create(channel, 'message payload');
        channel.send(target, msg);
        expect(dispatch).toHaveBeenCalledWith(msg);
    });

    it('should dispatch multiple messages to the eventTarget', () => {
        const target = new EventTarget();
        const dispatch = jest.spyOn(target, 'dispatchEvent');
        const channel = new Channel('test');
        const msgs = [1,2,3,4].map(n => Message.create(channel, `message payload: ${n}`));
        channel.send(target, ...msgs);
        msgs.forEach((msg) => {
            expect(dispatch).toHaveBeenCalledWith(msg);
        });
    });

    it('should dispatch messages already in channel', () => {
        const target = new EventTarget();
        const dispatch = jest.spyOn(target, 'dispatchEvent');
        const channel = new Channel('test');
        const msgs = [1,2,3,4].map(n => Message.create(channel, `message payload: ${n}`));
        const indicies = channel.put(...msgs);
        expect(indicies.length).toBe(4);
        indicies.forEach((channelIndex,i ) => {
            expect(typeof channelIndex).toBe('number');
            expect(channelIndex).toBeGreaterThan(-1);
            expect(channel.messages[channelIndex]).toEqual(msgs[i]);
        });
        // Only send the first three events;
        channel.send(target, indicies[0], indicies[1], indicies[2]);

        // The first thing should have been called.
        expect(dispatch).toHaveBeenCalledWith(msgs[0]);
        expect(dispatch).toHaveBeenCalledWith(msgs[1]);
        expect(dispatch).toHaveBeenCalledWith(msgs[2]);

        // ...But the fourth one should not.
        expect(dispatch).not.toHaveBeenCalledWith(msgs[3]);
    });

    it('should not dispatch messages which it does not have', () => {
        const target = new EventTarget();
        const dispatch = jest.spyOn(target, 'dispatchEvent');
        const channel = new Channel('test');
        const msgs = [1,2,3].map(n => Message.create(channel, `message payload: ${n}`));
        const index = channel.put(msgs[0])[0];
        const nonIndex = channel.messages.length + 1000;
        expect(channel.messages[nonIndex]).toBeUndefined();
        const sentIndicies = channel.send(
            target,
            index,      // Message already in channel.
            msgs[1],    // Message we're just now sending.
            nonIndex    // Message index which does not exist.
        );

        expect(sentIndicies.length).toBe(3); // Even though one message could not have been sent, we should have rows for all three.
        expect(sentIndicies[0]).toBe(index); // We already know this one.
        expect(sentIndicies[1]).toBe(index + 1); // This is the next message inserted; it should have the next row.
        expect(sentIndicies[2]).toBe(-1); // Because this message could not be sent (it did not exist) this should be the "fail" value.

        expect(dispatch).toHaveBeenCalledWith(msgs[0]); // The message that was put in the channel.
        expect(dispatch).toHaveBeenCalledWith(msgs[1]); // The messages that was sent.
        expect(dispatch).not.toHaveBeenCalledWith(msgs[2]); // The message which was not sent.
    });
})