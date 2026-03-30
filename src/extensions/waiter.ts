import type {Hub, ChannelRoute} from "../core";
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
    EXPECTED: 'EXPECTED ROUTE DID NOT EXIST',
    NO_ROUTES: 'NO VALID ROUTES',
};

/**
 * Enum defining success codes for {@link first} and {@link latest} functions.
 */
const SUCCESS = {
    ALL_RECEIVED: 'ALL_ROUTES_RECEIVED',
}

export type ResultSuccess<T> = [1, ChannelRoute, T];
export type ResultFailure = [0, ChannelRoute, string];
export type Results<T> = Array<ResultSuccess<T>|ResultFailure>

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
 * @param [expected=false] Whether `routes` should be expected.
 *
 * @example
 * const hub = new Hub();
 *
 * first(hub, r => console.log(`first: ${r}`), ['sandwich', 'soup'], 1000);
 *
 * hub.pub('sandwich', 'reuben');
 * hub.pub('sandwich', 'club');
 * hub.pub('soup', 'chicken');
 *
 * // "first: [['sandwich', 'reuben'], ['soup', 'chicken']]"
 */
function first<T>(hub: Hub, callback: (results: Results<T>) => void, routes: ChannelRoute[], waitTime: number, expected: boolean = false): void {
    Promise.allSettled(routes.map(route => {
        if (expected && !isFastReturnRoute(hub, route)) {
            // An expected route is not present, so reject immediately.
            return Promise.reject(ERRORS.EXPECTED);
        }
        return new Promise((resolve: (value: [r: ChannelRoute, v: T]) => void, reject) => {
            const unsub = hub.sub<T>(route, (payload) => {
                resolve([route, payload]);
				unsub();
            }, 1);
            if(waitTime > -1) {
                setTimeout(() => {
                    unsub();
                    reject(ERRORS.TIMED_OUT_SINGLE);
                }, waitTime);
            }
        });
    })).then(results => {
        callback(results.map((r, i) => {
           if(r.status === 'rejected') {
               return [0, routes[i], r.reason];
           }
           return [1, ...r.value];
        }));
    });
}

/**
 * Identical in behavior to {@link first}, but returns a Promise instead of accepting a callback.
 *
 * @param hub The {@link Hub} instance to which this will subscribe.
 * @param routes An array of route descriptors (see {@link Hub} for details on valid route descriptors).
 * @param waitTime Time in milliseconds to wait for a message before timing out.
 * @param [expected=false] Whether `routes` should be expected.
 *
 * @example
 * const hub = new Hub();
 *
 * firstAsync(hub, ['sandwich', 'soup'], 1000)
 * 	.then(r => console.log(`first: ${r}`));
 *
 * hub.pub('sandwich', 'reuben');
 * hub.pub('sandwich', 'club');
 * hub.pub('soup', 'chicken');
 *
 * // "first: [['sandwich', 'reuben'], ['soup', 'chicken']]"
 */
function firstAsync<T>(hub: Hub, routes: ChannelRoute[], waitTime: number, expected: boolean = false): Promise<Results<T>> {
	const firstWithHub = withHub(hub, first<T>);
	return asPromise<Results<T>, typeof firstWithHub>(firstWithHub)(routes, waitTime, expected);
}

class LatestCollector<T> extends Map<ChannelRoute, T> {
    toResults(): Array<ResultSuccess<T>> {
        return [...this.entries()]
            .map(([route, value]) => [1, route, value]);
    }
}

/**
 * Wait for all specified {@link routes} to receive at least one message, and return a set of the most recent.
 *
 * This function is essentially identical in behavior to {@link first} except that it will return the *last* messages
 * sent to every route, instead of the first. The usual use case here would be if you were listening to more than one
 * route and expect one (or more) of those routes to send several messages before all have completed.
 *
 * @see first
 *
 * @param hub The {@link Hub} instance to which this will subscribe.
 * @param callback If passed, this will be called with the results array. If not present, this function will instead return a Promise which resolves to the results array.
 * @param routes An array of route descriptors (see {@link Hub} for details on valid route descriptors).
 * @param waitTime Time in milliseconds to wait for a message before timing out.
 * @param [expected=false] Whether `routes` should be expected.
 *
 * @example
 * const hub = new Hub();
 *
 * last(hub, r => console.log(`last: ${r}`), ['sandwich', 'soup'], 1000);
 *
 * hub.pub('sandwich', 'reuben');
 * hub.pub('sandwich', 'club');
 * hub.pub('soup', 'chicken');
 *
 * // "last: [['sandwich', 'club'], ['soup', 'chicken']]"
 */
function latest<T>(hub: Hub, callback: ((results: Results<T>) => void), routes: ChannelRoute[], waitTime: number, expected: boolean = false): void {
    const waiter = new Promise((resolve: (results: Results<T>) => void, reject) => {
       let results: Results<T> = [];
       const controller = new AbortController();
       const collector = new LatestCollector<T>();
       if (expected) {
           routes = routes.filter(route => {
               if (isFastReturnRoute(hub, route)) {
                   return true;
               }
               results.push([0, route, ERRORS.EXPECTED]);
               return false;
           });
       }
       if (routes.length === 0) {
           // We have no valid routes, so we should return immediately.
           reject(ERRORS.NO_ROUTES);
       }
       if(waitTime > -1) {
           setTimeout(() => {
               controller.abort(ERRORS.TIMED_OUT_SINGLE);
               results = [...results, ...collector.toResults()];
               for (const route of routes) {
                   if (!collector.has(route)) {
                       results.push([0, route, ERRORS.TIMED_OUT_SINGLE]);
                   }
               }
               if(results.some(r => 1 === r[0])) {
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
                   resolve(collector.toResults());
               }
           }, 1, {signal: controller.signal})
       }
    });
    waiter.then(callback, failure => callback([[0, '*', failure.toString()]]));
}

/**
 * Identical in behavior to {@link latest}, but returns a Promise instead of accepting a callback.
 *
 * @param hub The {@link Hub} instance to which this will subscribe.
 * @param routes An array of route descriptors (see {@link Hub} for details on valid route descriptors).
 * @param waitTime Time in milliseconds to wait for a message before timing out.
 * @param [expected=false] Whether `routes` should be expected.
 *
 * @example
 * const hub = new Hub();
 *
 * lastAsync(hub, ['sandwich', 'soup'], 1000)
 * 	.then(r => console.log(`last: ${r}`));
 *
 * hub.pub('sandwich', 'reuben');
 * hub.pub('sandwich', 'club');
 * hub.pub('soup', 'chicken');
 *
 * // "last: [['sandwich', 'club'], ['soup', 'chicken']]"
 */
function latestAsync<T>(hub: Hub, routes: ChannelRoute[], waitTime: number, expected: boolean = false): Promise<Results<T>> {
	const latestWithHub = withHub(hub, latest<T>);
	return asPromise<Results<T>, typeof latestWithHub>(latestWithHub)(routes, waitTime, expected);
}

function setFastReturnRoutes(hub: Hub, ...routes: ChannelRoute[]) {
    hub.metadata.put('waiter.fast-return', ...routes.map(r => r.toString()));
}

function isFastReturnRoute(hub: Hub, route: ChannelRoute) {
    const routes = hub.metadata.get('waiter.fast-return');
    return routes.indexOf(route.toString()) >= 0;
}

/**
 * Return an array of only successes, in the format `[route, returnedValue]`.
 */
function getSucceeded<T>(results: Results<T>) {
    return results.reduce((collected: Array<[ChannelRoute, T]>, result: ResultFailure|ResultSuccess<T>) => {
        const [status, route, value] = result;
        if (status === 0) {
            return collected;
        }
        collected.push([route, value]);
        return collected;
    }, [])
}

/**
 * Return an array of only failures, in the format `[route, failureReason]`.
 */
function getFailed(results: Results<unknown>) {
    return results.reduce((collected: Array<[ChannelRoute, string]>, result: ResultFailure|ResultSuccess<unknown>) => {
        const [status, route, value] = result;
        if (status === 1) {
            return collected;
        }
        collected.push([route, value]);
        return collected;
    }, [])
}

export {
    first,
	firstAsync,
    latest,
	latestAsync,
    setFastReturnRoutes,
    isFastReturnRoute,
    getSucceeded,
    getFailed,
    ERRORS,
    SUCCESS,
    WaitForResults,
    WaitForResult
}
