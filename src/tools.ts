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

export type MatchArgument = RegExp | string;

/**
 * Test of `match` can be matched against `against`.
 *
 * If `match` is a regular expression, then JavaScript's RegExp `test()` is used. Note that this is only used if `match`
 * is a RegExp object, *not* of it is a string that looks like a regular expression—a string will be matched with the
 * string rules.
 *
 * If `match` is a string, it is matched against `against` using the following tests:
 * - `*` always matches.
 * - `word*` will match strings that begin with `word`, i.e. `wording`.
 * - `*word` will match strings that end with `word`, i.e. `unword`.
 * - `*or*` will match nothing; use a regular expression instead.
 * - Strings without a `*`, or that don't begin or end with `*` will be matched only if they are strictly equal to `against`.
 */
export const match = (match: MatchArgument, against: string) => {
    if ('*' === match) {
        return true;
    }

    if (match instanceof RegExp) {
        return match.test(against);
    }

    if (!match.includes('*')) {
        return match === against;
    }

	/**
	 * Because we've already discarded strings w/o '*', `getPartialSearch`
	 * cannot return false—hence we can safely use `as` to assert the type.
	 */
    const partial = getAffix(match) as {term: string, isSuffix: boolean};

    return partial.isSuffix
        ? against.endsWith(partial.term)
        : against.startsWith(partial.term);
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
