import Channel from "../src/channel";
import Message from "../src/message";

describe('Message', () => {
   it('should return a message', () => {
       const channel = new Channel('test');
       const message = Message.create(channel, 'message payload');
       expect(message.payload).toEqual('message payload');
       expect(message.channel).toBe(channel); // This should be a reference to the channel, not just something that looks like it.
       expect(typeof message.timestamp).toEqual('number');
   });

   it('should return properly formed JSON', () => {
       const channel = new Channel('test');
       const message = Message.create(channel, 'message payload');
       const JSONObject = message.toJSON();
       expect(JSONObject.payload).toEqual('message payload');
       expect(JSONObject.channel).toEqual('test');
       expect(typeof JSONObject.timestamp).toEqual('number');

       const str = JSON.stringify(message);
       expect(JSON.parse(str)).toEqual(JSONObject);
   })
});