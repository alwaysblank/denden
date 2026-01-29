import type {Hub} from '../core';

/**
 * Callback to {@link watch} to convert an event to a payload suitable for dispatch to a channel.
 *
 * @template Payload The value returned by this method, and carried by the message that {@link watch} dispatched to the channel.
 */
export type WatchProcessor<Payload> = (event: Event) => Payload;

/**
 * Watch an event emitter and retransmit events to a channel.
 *
 * @param hub Hub to which watched events will be dispatched.
 * @param channel The name of the channel to dispatch to. Will be created if it doesn't exit.
 * @param target EventTarget to watch for events of {@link eventType}.
 * @param eventType Type of event to watch for on {@link target}.
 * @param [processor] Callback to convert events from {@link target} into the appropriate payload for {@link channel}. Defaults to simply returning the entire event object.
 *
 * @template Payload The type of the payload carried by the message(s) being published.
 *
 * @example
 * const hub = new Hub();
 *
 * watch(hub, 'sandwiches', window, 'sandwich');
 *
 * hub.sub('sandwiches', (p) => console.log(`received: ${p}`));
 * window.dispatchEvent(new CustomEvent('sandwich', {detail: 'reuben'}));
 * // "received: reuben"
 */
export function watch<Payload>(hub: Hub, channel: string, target: EventTarget, eventType: string, processor?: WatchProcessor<Payload>) {
	if ('function' !== typeof processor) {
		// Default to just passing along the event as-is.
		processor = (event) => event as Payload;
	}
	const listener = (e: Event) => {
		hub.pub<Payload>(channel, processor(e));
	};
	target.addEventListener(eventType, listener);
	return () => target.removeEventListener(eventType, listener);
}
