/**
 * Sort an array of objects by one of their properties (must be numeric) in ascending or descending order.
 */
export const sortByProp = <O>(prop: keyof O, arr: O[], order: 'ASC'|'DESC') => {
	return arr.sort((a, b) => {
		const ap = a[prop];
		const bp = b[prop];
		if (typeof ap !== 'number' || typeof bp !== 'number') {
			return 0; // Can't sort these values;
		}
		switch (order) {
			case 'ASC':
				return ap - bp;
			case 'DESC':
				return bp - ap;
			default:
				return 0; // No reordering.
		}
	});
}