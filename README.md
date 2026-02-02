# Den-Den 🐌
Extremely simple publish/subscribe system built on events.

Designed for the browser, but should work in an JS context that supports events.

## Why?
Den-Den is meant to solve a couple of specific problems:
<details>
<summary>Retain a log of dispatched events.</summary>

```ts
const hub = new Hub();
hub.pub('sandwich', 'reuben');
hub.pub('sandwich', 'club');

hub.getMessages({cid: 'sandwich'})
  .map(m => m.payload);
// ['reuben', 'club']

hub.getMessages({cid: 'sandwich', order: 'ASC'})
hub.getMessages({cid: 'sandwich'})
  .map(m => m.payload);
// ['club', 'reuben']

// The '2' says to include the last 2 messages on the 'sandwich' channel.
hub.sub('sandwich', (p) => console.log(`payload: ${p}`), 2);
// "payload: club"
// "payload: reuben"

hub.pub('sandwich', 'cheese');
// "payload: cheese"
```

</details>

<details>
<summary>Attach subscribers to complex routes.</summary>

```ts
const hub = new Hub();

hub.sub('*', (payload) => console.log(`*: ${payload}`));
hub.sub('sand*', (payload) => console.log(`sand*: ${payload}`));
hub.sub(/.*er$/, (payload) => console.log(`regex: ${payload}`));

hub.pub('test', 'test value');
// "*: test value"

hub.pub('sandwich', 'reuben');
// "*: reuben"
// "sand*: reuben"

hub.pub('hammer', 'claw');
// "*: claw"
// "regex: claw"

hub.pub('sandpiper', 'bird');
// "*: bird"
// "sand*: bird"
// "regex: bird"
```

</details>

<details>
<summary>Know when all subscribers have received a given event.</summary>

```ts
const hub = new Hub();

hub.sub('sandwich', (p) => {
  doSomething(p);
});

hub.sub('sandwich', (p) => {
  return doSomethingAsynchronously(p);
});

hub.pub('sandwhich', 'reuben')
  .then(r => {
    // This executed when both callbacks have finished.
    // `r` is an array of the return values of both callbacks.
  });
```

> **NOTE:**
> A callback which contains a Promise but is not `async` must return a Promise or it cannot be tracked.

</details>

<details>
<summary>Create a system for dynamic dependency resolution at runtime without direct communication, race conditions, or timeouts.</summary>

**You have some logic that depends on dependencies whose load order is non-deterministic.**
```ts
const hub = new Hub();

first(hub, (results) => {
  const [dep1result, dep2result] = results;
  // This will execute after both dependencies have resolved, or after 1 second.
}, ['dependency-1', 'dependency-2'], 1000);

someExternalDependency().then(dependency => {
  hub.pub('dependency-1', dependency);
});

hub.pub('dependency-2', someOtherExternalDependency());
```

**You have some logic that other elements of your application should be able to modify.**
```ts
const hub = new Hub();

async function doSomething() {
  const settings = Map([
    ['active', true]
  ]);

  await hub.pub('doSomething/settings', settings)
    .then(results => {
      results.forEach(r => {
        if (r instanceof Error) {
          return; // Don't process errors.
        }
        const {add = [], remove = []} = r;
        add.forEach(([key, value]) => settings.set(key, value));
        remove.forEach(key => settings.delete(key));
      });
    });

  activate(settings);
}

hub.sub('doSomething/settings', (settings) => {
  if (settings.get('active')) {
    return ['port', 1234];
  }
});

doSomething();
// Settings map would look like:
// [ ['active', true], ['port', 1234] ]
```

</details>

## Installation
### Browser
Load `dist/browser.js` via a script tag to create a `window.denden` global hub.

`window.denden.queue` is an array to which you can push two types of records before Den-Den loads:
- **Message:** A tuple where the first element is the name of the channel, and the second is the payload to be sent.
- **Command:** A callback that will receive the hub instance as its only argument.

```html
<script>
  window.denden = window.denden || { queue: [] };
  window.denden.queue.push((hub) => hub.sub('sandwich', payload => console.log(`msg: ${payload}`), 1));
  window.denden.queue.push(['sandwich', 'reuben']);
  window.denden.queue.push(() => console.log('initialized'));
</script>

<script src="dist/browser.js"></script>
```

> You can still push to the queue *after* Den-Den loads, and the messages/commands will be processed immediately.
> However, in most cases it will be simpler to just call the hub instance directly once it exists.

This global instance also provides access to all tools and extensions via `window.denden.tools` and `window.denden.extensions`.
All extensions are bound to the global hub instance, so you don't need to provide a hub instance when calling them:

```js
// Yes.
window.denden.extensions.once('sandwich', p => console.log(p));

// No.
window.denden.extensions.once(window.denden, 'sandwich', p => console.log(p));
```

The `withHub` tool is similarly also bound to the global hub instance, so you need only pass the method you wish to bind:

```js
// Yes.
window.denden.tools.withHub((hub) => doSomethingWithHub(hub));

// No.
window.denden.tools.withHub(window.denden, (hub) => doSomethingWithHub(hub));
```

### Module
The `@alwaysblank/denden` module can be imported and will provide access to all internal classes and functions.
In most cases, you will only need `Hub` and any extensions you might want to use:

```ts
import { Hub, once } from '@alwaysblank/denden';

const hub = new Hub();

// Run a callback only once.
once(hub, 'sandwich', p => console.log(p));

hub.pub('sandwich', 'reuben');
hub.pub('sandwich', 'club');
// "reuben"
```

For more usage details, see the [documentation](https://alwaysblank.github.io/denden/).

## Channels

A "channel" is where messages are dispatched to, and the mechanism by which subscribers indicate which messages they wish to receive.
Each channel has a single name, in the form of a string key.
The key can be any string, but cannot contain a wildcard symbol (`*`).

### Routes

A channel "route" can describe a literal channel name (`sandwich`), a wildcard (`sand*` or `*wich`), or as regular expression (`/^sa.*ch$/`).

Routes can be used in both `Hub.sub()` and `Hub.pub()`, but the behavior is slightly different:

#### `sub()`

When `sub()` is invoked, it takes a route, or array of routes, as its first argument.
Any messages sent to a channel which matches any of the specified routes will be dispatched to the callback.

Routes can be either definitively named channels (i.e. `sandwich`), wildcard routes (e.g. `sand*` or `*wich`), regular expression routes (e.g. `/^sa.*ch$/`), or a mix of all three.

#### `pub()`

When `pub()` is invoked, it takes a route, or array of routes, as its first argument and a payload as its second argument.
The payload will be dispatched to all channels that match the specified routes.

Routes can be either definitively named channels (i.e. `sandwich`), wildcard routes (e.g. `sand*` or `*wich`), regular expression routes (e.g. `/^sa.*ch$/`), or a mix of all three.

Definitively named channels will be created if they do not already exist.
Non-definitive routes (i.e., wildcard or regex routes) will be resolved against any existing channels but _will not be created if they don't exist_ (since there is not enough information to infer definitive names from them).
This means that it is _not_ possible to "prepopulate" a channel search with messages for future subscribers.

Example:
```ts
hub.createChannel('sandwich');
hub.pub('sand*', 'reuben');

hub.sub('sandwich', (p) => console.log(`sandwich: ${p}`), 1);
// "sandwich: reuben"
hub.sub('sandpiper', (p) => console.log(`sandpiper: ${p}`), 1);
// No messages received.

hub.pub('sand*', 'club');
// "sandwich: club"
// "sandpiper: club"
```

Channels can also be manually created with `Hub.createChannel(name)`.

## Modules

The core module (`src/core.ts`) provides the most basic functionaltiy: 
A hub that can dispatch messages to subscribers and subscribe to channels.
This may provide all you need!
But the package also includes some other functionality in "extensions" to handle specific tasks that may save you some time.

> All extensions use the public API for the `Hub` and `Message` classes.
> In other words, you could build them yourself if you wanted to—they're only here to save you some time.

### Conditionals

A set of small tools to help with `Hub.sub()` for conditional subscriptions.

- [`once`](https://alwaysblank.github.io/denden/functions/once) - Remove the subscription after the first message is received.
- [`only`](https://alwaysblank.github.io/denden/functions/only) - Only messages in the channel which match a test will be sent to the callback.
- [`until`](https://alwaysblank.github.io/denden/functions/until) - Remove the subscription after a given condition is met. This is dependent on the order in which messages are received.

### Waiter

Tools for handling cases where you wish to collect responses from a set of different channels, potentially over time.

> These functions accept channel routes as arguments, so be sure to read the section on [Routes](#routes) above.

- [`first`](https://alwaysblank.github.io/denden/functions/first) - Returns an array containing the first message sent to each channel (route). Includes a timeout value, which will cause it to return early if no messages are received.
  - [`firstAsync`](https://alwaysblank.github.io/denden/functions/firstAsync) - The same behavior as `first`, except it returns a Promise instead of taking a callback.
- [`latest`](https://alwaysblank.github.io/denden/functions/latest) - Returns an array containing the most recent message sent to each channel (route). Includes a timeout value, which will cause it to return early if no messages are received.
  - [`latestAsync`](https://alwaysblank.github.io/denden/functions/latestAsync) - The same behavior as `latest`, except it returns a Promise instead of taking a callback.

### Watch

- [`watch`](https://alwaysblank.github.io/denden/functions/watch) - Watches an `EventEmitter` for events of the specified type, then dispatches them to the hub on the specified channel(s). See the rules above for using routes on `pub()`, which also apply here