import {getAffix, match, reverseString, sortByProp} from '../src/tools';

describe('sortByProp', () => {
   it('should sort by specified prop', () => {
       const arr = [
           {n: 3},
           {n: 1},
           {n: 2},
           {n: 10},
       ];

       const ascending = sortByProp(arr, 'n', 'ASC');
       const descending = sortByProp(arr, 'n', 'DESC');

       expect(ascending).not.toBe(arr);
       expect(descending).not.toBe(arr);

       expect(ascending).toEqual([
           {n: 1},
           {n: 2},
           {n: 3},
           {n: 10},
       ]);
       expect(descending).toEqual([
           {n: 10},
           {n: 3},
           {n: 2},
           {n: 1},
       ]);
   });

   it('should sort floats correctly', () => {
       const arr = [
           {n: performance.now(), m: 'one'},
           {n: performance.now(), m: 'two'},
           {n: performance.now(), m: 'three'},
           {n: performance.now(), m: 'four'},
       ];

       const ascending = sortByProp(arr, 'n', 'ASC');
       const descending = sortByProp(arr, 'n', 'DESC');

       expect(ascending).toStrictEqual(arr);
       expect(descending).not.toStrictEqual(arr);
       expect(descending).toStrictEqual(arr.toReversed());
   });

   it('should ignore non-numeric values', () => {
       const arr = [
           {n: 3},
           {n: 'sandwich'},
           {n: 2},
           {n: 10},
       ];
       const ascending = sortByProp(arr, 'n', 'ASC');
       expect(ascending).toEqual([
           {n: 2},
           {n: 3},
           {n: 10},
       ]);
   });

});

describe('match', () => {
	it.each([
		['sandwich', 'should', 'sandwich'],
		['sand*', 'should', 'sandwich'],
		['sand', 'should not', 'sandwich'],
		['*wich', 'should', 'sandwich'],
		['wich', 'should not', 'sandwich'],
		[/^s.*h$/, 'should', 'sandwich'],
		[/^s.*d$/, 'should not', 'sandwich'],
		['*dw*', 'should not', 'sandwich'],
		['*', 'should', 'sandwich'],
        [['*'], 'should', 'sandwich'],
        [[/^s.*d$/, '*wich'], 'should', 'sandwich'],
        [[/^s.*d$/, 'wich'], 'should not', 'sandwich'],
        [['sand*', '*wich'], 'should', 'sandwich'],
        [['sand*', 'sand*'], 'should', 'sandwich'],
        [['burger', 'sandwich'], 'should', 'sandwich'],
	])('%p %s match %p', (a, e, b) => {
		expect(match(a, b)).toBe('should' === e);
	});
});

describe('getAffix', () => {
	it.each([
		['sandwich', false],
		['sand*', {term: 'sand', isSuffix: false}],
		['*wich', {term: 'wich', isSuffix: true}],
		['*dw*', false],
		['*', false],
	])('"%s" should yield %p', (search, result) => {
		expect(getAffix(search)).toEqual(result);
	})
});

describe('reverseString', () => {
	it('should reverse the string', () => {
		const string = 'reuben sandwich';
		expect(reverseString(string)).toEqual('hciwdnas nebuer');
		expect(reverseString(reverseString(string))).toEqual('reuben sandwich');
	});
});