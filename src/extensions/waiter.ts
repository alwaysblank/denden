import type {Hub, ChannelRoute} from "../core";
import {asPromise, resolveRoute, withHub} from '../tools';

const METADATA = {
    FAST_RETURN: 'waiter.fast-return',
}

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
 * @param [fastReturn=false] Whether `routes` should be expected.
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
function first<T>(hub: Hub, callback: (results: Results<T>) => void, routes: ChannelRoute[], waitTime: number, fastReturn: boolean = false): void {
    Promise.allSettled(routes.map(route => {
        if (fastReturn && !isExpected(hub, route)) {
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
 * @param [fastReturn=false] Whether `routes` should be expected.
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
function firstAsync<T>(hub: Hub, routes: ChannelRoute[], waitTime: number, fastReturn: boolean = false): Promise<Results<T>> {
	const firstWithHub = withHub(hub, first<T>);
	return asPromise<Results<T>, typeof firstWithHub>(firstWithHub)(routes, waitTime, fastReturn);
}

/**
 * Use by {@link latest} to collect results and ultimately return them.
 */
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
 * @param {Object} hub The {@link Hub} instance to which this will subscribe.
 * @param {function} callback If passed, this will be called with the results array. If not present, this function will instead return a Promise which resolves to the results array.
 * @param {Array} routes An array of route descriptors (see {@link Hub} for details on valid route descriptors).
 * @param {number} waitTime Time in milliseconds to wait for a message before timing out.
 * @param {Object} settings Optional setting that control behavior of `latest`.
 * @param {boolean} [settings.fastReturn=false] If true, any items in `routes` that aren't registered as "expected" will immediately reject.
 * @param {number} [settings.backlog=1] Number of messages to pull from the backlog when subscribing, if any.
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
function latest<T>(hub: Hub, callback: ((results: Results<T>) => void), routes: ChannelRoute[], waitTime: number, settings: {
    backlog?: number;
} = {}): void {
    tail(
        hub,
        callback,
        ({ options }) => {
            options = {
                ...options,
                ...settings,
            }
            options.routes = routes;
            options.waitTime = waitTime;
        }
    )
}

/**
 * Identical in behavior to {@link latest}, but returns a Promise instead of accepting a callback.
 *
 * @param hub The {@link Hub} instance to which this will subscribe.
 * @param routes An array of route descriptors (see {@link Hub} for details on valid route descriptors).
 * @param waitTime Time in milliseconds to wait for a message before timing out.
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
function latestAsync<T>(hub: Hub, routes: ChannelRoute[], waitTime: number): Promise<Results<T>> {
    const latestWithHub = withHub(hub, latest<T>);
    return asPromise<Results<T>, typeof latestWithHub>(latestWithHub)(routes, waitTime);
}

function expectedLatest<T>(hub: Hub, callback: ((results: Results<T>) => void), routes: string[], waitTime: number, settings: {
    backlog?: number;
} = {}): void {
    tail(
        hub,
        callback,
        ({
             options,
             results,
         }) => {
            options.waitTime = waitTime;
            options.routes = routes.filter(route => {
                if (!isExpected(hub, route)) {
                    results.push([0, route, ERRORS.EXPECTED]);
                    return false;
                }
                return true;
            });
            if (settings.backlog) {
                options.backlog = settings.backlog;
            }
        }
    )
}

/**
 * Core logic for `latest` functions.
 */
function tail<T>(hub: Hub, resolved: (results: Results<T>) => void, setup: ({resolve, reject, results, controller, collector, options}: {
    resolve: Function,
    reject: Function,
    results: Results<T>,
    controller: AbortController,
    collector: LatestCollector<T>,
    options: {
        routes: ChannelRoute[],
        waitTime: number,
        backlog?: number,
    }
}) => void): void {
    const waiter = new Promise((resolve: (results: Results<T>) => void, reject: (reason: string) => void) => {
        let results: Results<T> = [];
        const controller = new AbortController();
        const collector = new LatestCollector<T>();
        const options: {
            routes: ChannelRoute[],
            waitTime: number,
            backlog?: number,
        } = {
            routes: [],
            waitTime: 0,
        };
        setup({
            resolve,
            reject,
            results,
            controller,
            collector,
            options,
        });
        const {routes, waitTime, backlog = 1} = options;
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
            }, backlog, {signal: controller.signal})
        }
    });
    waiter.then(resolved, failure => resolved([[0, '*', failure.toString()]]));
}

function setExpected(hub: Hub, ...routes: ChannelRoute[]) {
    hub.metadata.put(METADATA.FAST_RETURN, ...routes);
}

function isExpected(hub: Hub, route: ChannelRoute) {
    const routes: ChannelRoute[] = hub.metadata.get(METADATA.FAST_RETURN) || [];
    for (const expected of routes) {
        if (route instanceof RegExp) {
            return expected instanceof RegExp && expected.toString() === route.toString();
        }
        if (resolveRoute(expected, [route]).size > 0) {
            return true;
        }
    }
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
    setExpected,
    isExpected,
    getSucceeded,
    getFailed,
    ERRORS,
    SUCCESS,
    METADATA,
}
