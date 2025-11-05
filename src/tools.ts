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
export const match = (needle: RegExp | string, haystack: string) => {
    if ('*' === needle) {
        return true;
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
