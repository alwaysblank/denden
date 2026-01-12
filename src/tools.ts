import type {Hub} from './hub';

export type OmitFirstArg<F> = F extends (x: any, ...args: infer P) => infer R ? (...args: P) => R : never;


/**
 * Sort an array of objects by one of their properties (must be numeric) in ascending or descending order.
 *
 * Entries where `prop` has a non-numeric value will simply be discarded from the returned array.
 *
 * @return A sorted copy of `arr`.
 */
export const sortByProp = <O>(arr: O[], prop: keyof O, order: 'ASC' | 'DESC') => {
    return [...arr]
        .filter(r => 'number' === typeof r[prop])
        .sort((a, b) => {
            // The previous filter guarantees that this are numbers.
            const ap = a[prop] as number;
            const bp = b[prop] as number;
            switch (order) {
                case 'ASC':
                    return ap - bp;
                case 'DESC':
                    return bp - ap;
            }
        });
}

export type MatchNeedle = string | RegExp | Array<string|RegExp>;

/**
 * Test if `needle` can be matched against `haystack`.
 *
 * If `needle` is a regular expression, then JavaScript's RegExp `test()` is used. Note that this is only used if `needle`
 * is a RegExp object, *not* if it is a string that looks like a regular expression—a string will be matched with the
 * string rules.
 *
 * If `needle` is a string, it is matched against `haystack` using the following tests:
 * - `*` always matches.
 * - `word*` will needle strings that begin with `word`, i.e. `wording`.
 * - `*word` will needle strings that end with `word`, i.e. `unword`.
 * - `*or*` will needle nothing; use a regular expression instead.
 * - Strings without a `*`, or that don't begin or end with `*` will be matched only if they are strictly equal to `haystack`.
 */
export const match = (needle: MatchNeedle, haystack: string): boolean => {
    if ('*' === needle) {
        return true;
    }

    if (Array.isArray(needle)) {
        return needle.some((n) => match(n, haystack));
    }

    if (needle instanceof RegExp) {
        return needle.test(haystack);
    }

    if (!needle.includes('*')) {
        return needle === haystack;
    }

	/**
	 * Because we've already discarded strings w/o '*', `getPartialSearch`
	 * cannot return false—hence we can safely use `as` to assert the type.
	 */
    const partial = getAffix(needle) as {term: string, isSuffix: boolean};

    return partial.isSuffix
        ? haystack.endsWith(partial.term)
        : haystack.startsWith(partial.term);
}

/**
 * Given a string `str` in the form of `word*` or `*word` return the search term and whether it is a suffix or not.
 *
 * Terms such as `*` or `*or` will fail because they can't be reduced to a single affix.
 *
 * @return An object with the `term` and `isSuffix` properties, or boolean `false` if no valid search term can be found.
 */
export const getAffix = (str: string) => {
    if (!str.includes('*') || '*' === str) {
        return false;
    }
    let reverse = false;
    if (str.startsWith('*')) {
        str = reverseString(str);
        reverse = true;
    }
    if (!str.endsWith('*') || (str.endsWith('*') && str.startsWith('*'))) {
        return false;
    }
    const partial = str.substring(0, str.length - 1);
    return {
        term: reverse ? reverseString(partial) : partial,
        isSuffix: reverse,
    }
}

/**
 * Return a reversed copy of `str`.
 */
export const reverseString = (str: string) => {
	return str.split('').reverse().join('');
}

/**
 * Returns a version of {@link func} which returns a Promise rather than expecting a callback.
 *
 * @example
 * const fn = (callback, a, b) => doSomething(callback, a, b);
 * const promised = asPromise(fn);
 * promised(1, 2).then(result => console.log(result));
 *
 * @param func Function that expects a callback as its first argument.
 *
 * @template A The argument that will be passed to the callback.
 * @template F The type of {@link func}.
 */
export function asPromise<A, F extends (callback: (a: A) => any, ...args: any[]) => any>(func: F) {
	return (...args: Parameters<OmitFirstArg<F>>) => {
		return new Promise<A>((resolve) => {
			func(a => resolve(a), ...args);
		})
	}
}

/**
 * Returns a version of {@link func} which that is bound to {@link hub}, and therefore does not need to specify the hub to use.
 *
 * @example
 * const hub = new Hub();
 * latest(hub, callback, 'test', 100);
 * // With withHub:
 * const waiter = withHub(hub, latest);
 * waiter(callback, 'test', 100);
 *
 * @param hub The {@link Hub} instance to which this function will be bound.
 * @param func The function to be bound.
 *
 * @template Args Arguments passed to {@link func}.
 * @template R Return type of {@link func}.
 */
export function withHub<Args extends any[], R>(
	hub: Hub,
	func: (hub: Hub, ...args: Args) => R
): ((...args: Args) => R) {
	return (...args: Args) => func(hub, ...args);
}
