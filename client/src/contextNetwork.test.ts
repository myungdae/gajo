import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filteredEdges, type Ecosystem } from './contextNetwork.ts';
test('filters preserve evidence types and do not invent recommendations', () => {
  const data = {nodes:[{id:'a',status:'VERIFIED'},{id:'b',status:'PARTIAL'},{id:'c',status:'VERIFIED'}],edges:[
    {source:'a',target:'b',relation:'NEARBY'}, {source:'a',target:'c',relation:'ACTUAL_USAGE'},
    {source:'b',target:'c',relation:'INTEREST'}, {source:'c',target:'a',relation:'MOVEMENT_INTENT'}
  ]} as Ecosystem;
  assert.equal(filteredEdges(data,'ALL').length,4);
  assert.deepEqual(filteredEdges(data,'RESOURCE_RELATIONSHIP'),[data.edges[0]]);
  assert.deepEqual(filteredEdges(data,'VERIFIED_USE'),[data.edges[1]]);
  assert.deepEqual(filteredEdges(data,'INTEREST'),[data.edges[2]]);
  assert.deepEqual(filteredEdges(data,'MOVEMENT_INTENT'),[data.edges[3]]);
  assert.deepEqual(filteredEdges({...data,edges:[]},'ALL'),[]);
});
