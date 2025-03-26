# Den Den

Extremely simple publish/subscribe system built on events and nothing else.

Designed for the browser, but should work in an JS context that supports events.

## Examples

```javascript
const hub = new Hub();

hub.sub('recipes', (payload) => console.log(payload) );

hub.pub('recipes', 'add eggs');

// "add eggs"
```