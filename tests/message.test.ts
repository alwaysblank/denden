import Message from "../src/message";

describe('Message', () => {
   it('should return a message', () => {
       const message = Message.create('test', 'message payload');
       expect(message.payload).toEqual('message payload');
       expect(message.channel).toBe('test'); // This should be a reference to the channel, not just something that looks like it.
       expect(typeof message.order).toEqual('number');
   });

   it('should return properly formed JSON', () => {
       const message = Message.create('test', 'message payload');
       const JSONObject = message.toJSON();
       expect(JSONObject.payload).toEqual('message payload');
       expect(JSONObject.channel).toEqual('test');
       expect(typeof JSONObject.order).toEqual('number');

       const str = JSON.stringify(message);
       expect(JSON.parse(str)).toEqual(JSONObject);
   })
});