import {Hub} from './core';
import {makeQueue, QueuedRecord} from './queue';
import {once, only, until} from './extensions/conditionals';
import {asPromise, getAffix, match, reverseString, sortByProp, withHub} from './tools';
import {first, firstAsync, latest, latestAsync} from './extensions/waiter';
import {watch} from './extensions/watch';

type BrowserHub = Hub & {
	extensions: typeof extensions,
	tools: typeof tools,
	queue: QueuedRecord[],
};

declare global {
    interface Window {
        denden: BrowserHub;
    }
}

window.denden = window.denden || {
	queue: [],
}
window.denden.queue.push((h: Hub) => window.dispatchEvent(new CustomEvent<Hub>('ddm::ready', {detail: h})));

const hub = new Hub() as BrowserHub;
const tools = {
	withHub: <Args extends any[], R>(func: (hub: Hub, ...args: Args) => R) => withHub(hub, func),
	asPromise,
	sortByProp,
	match,
	getAffix,
	reverseString,
}
const extensions = {
	once: tools.withHub(once),
	until: tools.withHub(until),
	only: tools.withHub(only),
	watch: tools.withHub(watch),
	first: tools.withHub(first),
	firstAsync: tools.withHub(firstAsync),
	latest: tools.withHub(latest),
	latestAsync: tools.withHub(latestAsync),
}
const queue = makeQueue(hub, window.denden.queue ?? []);

window.denden = new Proxy<BrowserHub>(hub, {
	get(target: Hub, p: string | symbol, receiver: any): any {
		if ('string' === typeof p) {
			switch (p) {
				case 'extensions': return extensions;
				case 'tools': return tools;
				case 'queue': return queue;
			}
		}
		return Reflect.get(target, p, receiver);
	}
});