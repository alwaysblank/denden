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

## Installation

If you want to use this as a library in your code, `import {Hub} from "@alwaysblank/denden"` will get you the `Hub` class which is most of what you need:

```js
const hub = new Hub();

hub.sub('sandwich', payload => console.log(`msg: ${payload}`));
hub.pub('sandwich', 'reuben');

// "msg: reuben"
```

If you just want to use it in the browser directly, `dist/browser.js` is an IIFE compiled for the browser.
It creates a global `window.denden` hub, and looks for a `window._dendenQueue` object from which it will load pre-existing messages.
This allows you to prepopulate channels with messages before denden itself has loaded:

```js
window._dendenQueue.push(['sandwich', 'reuben']);

// denden loads

window.denden.sub('sandwich', payload => console.log(`msg: ${payload}`), 1);
// "msg: reuben"

window.denden.pub('sandwich', 'club');
// "msg: club"
```

## Examples

**Allow hooking into behavior via `sub()`**

```ts
const hub = new Hub();

hub.sub<number>('allow-action', (payload) => {
  return payload > 1;
});

hub.sub<number>('allow-action', (payload) => {
  return payload < 10;
});

hub.sub<number>('allow-action', (payload) => {
  return payload > 5;
});

async function maybeDoAThing(num: number) {
    const results = await hub.pub('allow-action', num);
    if (!results.some(r => r === false)) {
      doThing();
    }
}

maybeDoAThing(8);
// doThing() will execute

maybeDoAThing(11);
// doThing() will not execute
```
