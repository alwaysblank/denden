import {match, MatchArgument, sortByProp} from "../src/tools";

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

   it.each([
       ['sandwich', 'should', 'sandwich'],
       ['sand*', 'should', 'sandwich'],
       ['*wich', 'should', 'sandwich'],
       [/^s.*h$/, 'should', 'sandwich'],
       [/^s.*d$/, 'should not', 'sandwich'],
       ['*dw*', 'should not', 'sandwich'],
   ])('%p %s match %p', (a: MatchArgument, e: 'should'|'should not', b: string) => {
       expect(match(a, b)).toBe('should' === e);
   });
});