export const sortByProp = (prop: string, arr: Record<string, any>, order: 'ASC'|'DESC') => {
	return arr.sort((a: Record<string, any>, b: Record<string, any>) => {
		switch (order) {
			case 'ASC':
				return a[prop] - b[prop];
			case 'DESC':
				return b[prop] - a[prop];
			default:
				return 0; // No reordering.
		}
	});
}