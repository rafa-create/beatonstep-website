#!/usr/bin/env node
/**
 * READ-ONLY check after a manual Wrangler deployment.
 * No D1 write, no auth token, no card claim, no GitHub runner.
 */
import assert from 'node:assert/strict';
const base='https://beatonstep.app';
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),12000);
try{
  const response=await fetch(base+'/api/health',{
    cache:'no-store',signal:controller.signal,
    headers:{accept:'application/json'},
  });
  assert.equal(response.status,200,'Cloudflare public /api/health must respond 200');
  const health=await response.json();
  assert.equal(health.status,'ok');
  assert.equal(health.catalog,'d1');
  assert.equal(health.database,true,'D1 binding unavailable');
  assert.equal(health.schemaReady,true,'existing catalog tables not ready');
  assert.ok(health.sport&&typeof health.sport==='object',
    'Worker code was not yet deployed; missing sport health diagnostic');
  assert.equal(health.sport.schemaReady,true,
    '0010/0009/0008 sport D1 tables/triggers are not all ready');
  for(const field of [
    'worldCardsEnabled','giftsEnabled','autoAwardsEnabled',
  ])assert.equal(health.sport[field],true,field+' must be enabled in production');
  console.log('PASS deployed Cloudflare Worker + production D1 sport schema');
  console.log('PASS sport rewards, gifts and automatic awards are enabled in production');
  const page=await fetch(base+'/cadeau-sport.html',{
    cache:'no-store',signal:controller.signal,
  });
  assert.equal(page.status,200,'Sport gift HTML is not deployed');
  const html=await page.text();
  assert.match(html,/Cadeau sportif/);
  assert.match(html,/Prouver qu'il a tort/);
  console.log('PASS static sport gift page is deployed');
  console.log('PASS direct VM/Cloudflare release validation; GitHub Actions not required');
}finally{clearTimeout(timeout)}
