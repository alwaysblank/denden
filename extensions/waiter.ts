import Hub, {ChannelRoute} from "../src/hub";

export type WaitForResult<T> = [ChannelRoute, T];

export interface WaitForResults<T> extends Array<WaitForResult<T>> {
    failed?: Array<[ChannelRoute, string]>,
}

export const ERRORS = {
    TIMED_OUT_SINGLE: 'TIMED OUT',
    TIMED_OUT_ALL: 'ALL ROUTES TIMED OUT',
};

export const SUCCESS = {
    ALL_RECEIVED: 'ALL_ROUTES_RECEIVED',
}

/**
 * Wait for the first message(s) sent to the specified routes, within the specified timeout.
 *
 * The results passed to `callback()` will be an array of tuples where the first item is the route and the second is
 * the payload received. Each route resolves as soon as it receives a message, so `results` will always contain the
 * *first* message sent to any route. If you want the *most recent* message from each channel when `callback()` is
 * called, use {@link latest}.
 *
 * The `results` value passed to `callback()` is ah array of tuples for each route that successfully received a message
 * before the timeout expired. Each tuple has the form `[ routeName, messagePayload ]`. If any routes failed, the
 * `results` object will also have a `failed` property (if none failed, this property is undefined). The `failed`
 * property is an array of tuples with the form `[ routeName, failureReason ]`. In most cases, `failureReason` will
 * be `'TIMED OUT`, indicating that the route did not return a message before the timeout.
 *
 * The `waitTime` value is passed to `setTimeout()` as the {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#delay delay}, which means it is bound by the limitations inherent
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
 * @param hub - The hub to which we should listen for messages.
 * @param routes - An array of routes to listen to.
 * @param callback - The function to be called when all routes have returned (or the timeout has been reached).
 * @param [waitTime=-1] - Time in milliseconds to wait for messages to be received. A value of `-1` will prevent timeout.
 */
export function first<T>(hub: Hub, routes: ChannelRoute[], callback: (results: WaitForResults<T>) => void, waitTime: number = -1)  {
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
        succeeded.failed = failed;
        callback(succeeded);
    });
}

/**
 * Wait for all specified routes to receive at least one message, and return a set of the most recent.
 *
 * This function is essentially identical in behavior to {@link first} except that it will return the *last* messages
 * sent to every route, instead of the first. The usual use case here would be if you are listening to more than one
 * route, and expect one (or more) of those routes to send several messages before all have completed.
 *
 * @see first
 *
 * @param hub - The hub to which we should listen for messages.
 * @param routes - An array of routes to listen to.
 * @param callback - The function to be called when all routes have returned (or the timeout has been reached).
 * @param [waitTime=-1] - Time in milliseconds to wait for messages to be received. A value of `-1` will prevent timeout.
 */
export function latest<T>(hub: Hub, routes: ChannelRoute[], callback: (results: WaitForResults<T>) => void, waitTime: number = -1) {
    const waiter = new Promise((resolve: (results: WaitForResults<T>) => void, reject) => {
       const controller = new AbortController();
       const collector = new Map<ChannelRoute, T>();
       if(waitTime > -1) {
           setTimeout(() => {
               controller.abort(ERRORS.TIMED_OUT_SINGLE);
               const results: WaitForResults<T> = [...collector.entries()];
               if (results.length === routes.length) {
                   resolve(results);
               }
               results.failed = [];
               for (const route of routes) {
                   if (!collector.has(route)) {
                       results.failed.push([route, ERRORS.TIMED_OUT_SINGLE]);
                   }
               }
               if(routes.length > results.failed.length) {
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
           }, 1, { signal: controller.signal})
       }
    });
    waiter.then(callback, failure => {
        const result: WaitForResults<T> = [];
        if (ERRORS.TIMED_OUT_ALL === failure) {
            result.failed = routes.map(route => {
                return [route, ERRORS.TIMED_OUT_SINGLE];
            });
        } else {
            result.failed = ['*', failure.toString()];
        }
        callback(result);
    });
}