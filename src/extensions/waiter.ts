import type { Hub } from "../hub";
import type { ChannelRoute } from "../hub";
import {asPromise, withHub} from '../tools';

/**
 * A single result from a {@link first} or {@link latest} operation.
 */
type WaitForResult<T> = [ChannelRoute, T];

/**
 * The results from a {@link first} or {@link latest} operation.
 */
type WaitForResults<T> = Array<WaitForResult<T>> & {failed?: Array<[ChannelRoute, string]>};

/**
 * Enum defining error codes for {@link first} and {@link latest} functions.
 */
const ERRORS = {
    TIMED_OUT_SINGLE: 'TIMED OUT',
    TIMED_OUT_ALL: 'ALL ROUTES TIMED OUT',
};

/**
 * Enum defining success codes for {@link first} and {@link latest} functions.
 */
const SUCCESS = {
    ALL_RECEIVED: 'ALL_ROUTES_RECEIVED',
}

/**
 * Wait for the first message(s) sent to the specified {@link routes}, within the specified timeout.
 *
 * Returns an array of results once one of the following is true:
 * - All {@link routes} have received a message.
 * - {@link waitTime} has elapsed.
 *
 * In either case, the ultimate results will be an array containing tuples of the form `[routeName, payload]`
 * for every route which successfully produces a message. If any routes timed out or otherwise failed,
 * the `results` object will have a `failed` property, containing an array of tuples in the form
 * `[routeName, reasonForFailure]`.
 *
 * This function captures the first messages it receives on each route. If you want the latest (or last) messages
 * for each route, use {@link latest}.
 *
 * {@link waitTime} is passed to `setTimeout()` as the {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#delay delay}, which means it is bound by the limitations inherent
 * in that mechanism. There are a few values that will trigger special behavior:
 *
 * - `-1` - This is the default value. This value prevents the listener from every timing out: It will wait
 *      forever if it never receives an event. This is not `setTimeout()` behavior; if this value is passed,
 *      `setTimeout()` is simply never called.
 * - `0` - The timeout will expire in the next event cycle. This is usually close to "immediately," but will usually
 *      take more than 0 actual milliseconds. In the context of denden's messaging, this will usually only return
 *      something if there are messages in the queue already.
 * - `214748364` (or greater) - The actual number here varies, but this is the maximum delay value. Setting this value,
 *      or higher, will result in odd behavior—i.e. overflowing to 0 or negative numbers, etc. This is 20+ days, so
 *      it's very unlikely you would ever need to set a value this high. In most cases, you would probably just want to
 *      use `-1` instead.
 *
 * @see latest
 *
 * @param hub The {@link Hub} instance to which this will subscribe.
 * @param callback If passed, this will be called with the results array. If not present, this function will instead return a Promise which resolves to the results array.
 * @param routes An array of route descriptors (see {@link Hub} for details on valid route descriptors).
 * @param waitTime Time in milliseconds to wait for a message before timing out.
 */
function first<T>(hub: Hub, callback: (results: WaitForResults<T>) => void, routes: ChannelRoute[], waitTime: number): void {
    Promise.allSettled(routes.map(route => {
        return new Promise((resolve: (value: [r: ChannelRoute, v: T]) => void, reject) => {
            const unsub = hub.sub<T>(route, (payload) => {
                resolve([route, payload]);
            }, 1);
            if(waitTime > -1) {
                setTimeout(() => {
                    unsub();
                    reject(ERRORS.TIMED_OUT_SINGLE);
                }, waitTime);
            }
        });
    })).then(results => {
        const failed: WaitForResults<T>["failed"] = [];
        const succeeded: WaitForResults<T> = results.filter((result, i): result is PromiseFulfilledResult<WaitForResult<T>> => {
            if (result.status === 'rejected') {
                const channel = routes[i];
                failed.push([channel, result.reason]);
                return false;
            }
            return true;
        }).map(({value}) => value);
        if (failed.length > 0) {
            succeeded.failed = failed;
        }
        callback(succeeded);
    });
}

/**
 * Identical in behavior to {@link first}, but returns a Promise instead of accepting a callback.
 *
 * @param hub The {@link Hub} instance to which this will subscribe.
 * @param routes An array of route descriptors (see {@link Hub} for details on valid route descriptors).
 * @param waitTime Time in milliseconds to wait for a message before timing out.
 */
function firstAsync<T>(hub: Hub, routes: ChannelRoute[], waitTime: number): Promise<WaitForResults<T>> {
	const firstWithHub = withHub(hub, first<T>);
	return asPromise<WaitForResults<T>, typeof firstWithHub>(firstWithHub)(routes, waitTime);
}

/**
 * Wait for all specified {@link routes} to receive at least one message, and return a set of the most recent.
 *
 * This function is essentially identical in behavior to {@link first} except that it will return the *last* messages
 * sent to every route, instead of the first. The usual use case here would be if you are listening to more than one
 * route and expect one (or more) of those routes to send several messages before all have completed.
 *
 * @see first
 *
 * @param hub The {@link Hub} instance to which this will subscribe.
 * @param callback If passed, this will be called with the results array. If not present, this function will instead return a Promise which resolves to the results array.
 * @param routes An array of route descriptors (see {@link Hub} for details on valid route descriptors).
 * @param waitTime Time in milliseconds to wait for a message before timing out.
 *
 * @return Promise if `callback` is passed; void otherwise.
 */
function latest<T>(hub: Hub, callback: ((results: WaitForResults<T>) => void), routes: ChannelRoute[], waitTime: number): void {
    const waiter = new Promise((resolve: (results: WaitForResults<T>) => void, reject) => {
       const controller = new AbortController();
       const collector = new Map<ChannelRoute, T>();
       if(waitTime > -1) {
           setTimeout(() => {
               controller.abort(ERRORS.TIMED_OUT_SINGLE);
               const results: WaitForResults<T> = [...collector.entries()];
               for (const route of routes) {
                   if (!collector.has(route)) {
                       if (!Array.isArray(results.failed)) {
                           results.failed = [];
                       }
                       results.failed.push([route, ERRORS.TIMED_OUT_SINGLE]);
                   }
               }
               if(!results.failed || routes.length > results.failed.length) {
                   // At least one route succeeded, so resolve.
                   resolve(results);
               }
               // Every route failed, so reject.
               reject(ERRORS.TIMED_OUT_ALL);
           }, waitTime);
       }
       for (const route of routes) {
           hub.sub<T>(route, (payload) => {
               collector.set(route, payload);
               if (collector.size === routes.length) {
                   controller.abort(SUCCESS.ALL_RECEIVED);
                   resolve([...collector.entries()]);
               }
           }, 1, {signal: controller.signal})
       }
    });
    waiter.then(callback, failure => {
        const result: WaitForResults<T> = [];
        result.failed= [['*', failure.toString()]];
        callback(result);
    });
}

/**
 * Identical in behavior to {@link latest}, but returns a Promise instead of accepting a callback.
 *
 * @param hub The {@link Hub} instance to which this will subscribe.
 * @param routes An array of route descriptors (see {@link Hub} for details on valid route descriptors).
 * @param waitTime Time in milliseconds to wait for a message before timing out.
 */
function latestAsync<T>(hub: Hub, routes: ChannelRoute[], waitTime: number): Promise<WaitForResults<any>> {
	const latestWithHub = withHub(hub, latest<T>);
	return asPromise<WaitForResults<any>, typeof latestWithHub>(latestWithHub)(routes, waitTime);
}

export {
    first,
	firstAsync,
    latest,
	latestAsync,
    ERRORS,
    SUCCESS,
    WaitForResults,
    WaitForResult
}
