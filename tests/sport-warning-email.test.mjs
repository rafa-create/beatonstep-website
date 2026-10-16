import test from 'node:test';
import assert from 'node:assert/strict';
import {processPendingSportWarningEmails} from '../worker/sport-warning-email.js';

function fixture(){
  const state={delivery:'pending',attempts:0,next:0,sentAt:null};
  const queries=[];
  const row={card_id:71,owner_epoch:3,distance_cm:500000,
    time_unit:'minute',sub_value:20,peak_speed_kmh:75};
  const db={prepare(sql){
    const stmt={args:[],bind(...args){this.args=args;return this},
      async first(){
        assert.match(sql,/FROM admin_users WHERE disabled=0/);
        return {email:'same-admin@example.test'};
      },
      async all(){
        assert.match(sql,/FROM sport_card_telemetry_mail_delivery/);
        return {results:state.delivery!=='sent'&&state.next<=this.args[0]
          ?[row]:[]};
      },
      async run(){
        queries.push({sql,args:this.args});
        if(sql.includes("SET state='sending'")){
          if(state.delivery==='sent'||state.next>this.args[3])
            return {meta:{changes:0}};
          state.delivery='sending';state.attempts++;state.next=this.args[0];
          return {meta:{changes:1}};
        }
        if(sql.includes("SET state='sent'")){
          assert.equal(state.delivery,'sending');
          state.delivery='sent';state.sentAt=this.args[0];
          return {meta:{changes:1}};
        }
        if(sql.includes("SET state='pending'")){
          state.delivery='pending';state.next=this.args[0];
          return {meta:{changes:1}};
        }
        throw Error('unexpected D1 mutation '+sql);
      },
    };
    return stmt;
  }};
  return {db,state,queries};
}
const env={RESEND_API_KEY:'mock-secret',
  PASSWORD_RESET_EMAIL_FROM:'no-reply@beatonstep.app'};

test('one 75 km/h warning uses the existing admin address and one Resend message',async()=>{
  const f=fixture(),messages=[];
  const send=async(url,options)=>{
    messages.push({url,options,payload:JSON.parse(options.body)});
    return {ok:true,status:200};
  };
  const now=1_792_000_000_000;
  assert.equal(await processPendingSportWarningEmails(f.db,env,{now,send}),1);
  assert.equal(await processPendingSportWarningEmails(f.db,env,{now,send}),0);
  assert.equal(messages.length,1);
  assert.equal(messages[0].url,'https://api.resend.com/emails');
  assert.deepEqual(messages[0].payload.to,['same-admin@example.test']);
  assert.equal(messages[0].payload.from,env.PASSWORD_RESET_EMAIL_FROM);
  assert.match(messages[0].payload.text,/75 km\/h/);
  assert.match(messages[0].payload.text,/admin\.html#warnings/);
  assert.equal(messages[0].options.headers['Idempotency-Key'],'bos-warning-71-3');
  assert.equal(f.state.delivery,'sent');
  assert(!f.queries.some(x=>/UPDATE sport_world_cards|DELETE FROM sport_world_cards/.test(x.sql)));
});

test('mail failure defers its retry; it cannot touch an awarded card',async()=>{
  const f=fixture();let attempts=0;
  const silentConsole=console.warn;
  console.warn=()=>{};
  try {
    const send=async()=>{attempts++;return {ok:attempts>=2,status:503}};
    const now=1_792_000_000_000;
    assert.equal(await processPendingSportWarningEmails(f.db,env,{now,send}),0);
    assert.equal(f.state.delivery,'pending');
    assert.equal(f.state.next,now+15*60000);
    assert.equal(await processPendingSportWarningEmails(f.db,env,{now,send}),0);
    assert.equal(attempts,1);
    assert.equal(await processPendingSportWarningEmails(f.db,env,{
      now:now+15*60000+1,send}),1);
    assert.equal(f.state.delivery,'sent');
  } finally {
    console.warn=silentConsole;
  }
});

test('no configured Resend means no attempt and no D1 writes',async()=>{
  const f=fixture();
  assert.equal(await processPendingSportWarningEmails(f.db,{},{
    send:()=>{throw Error('must not send')}}),0);
  assert.deepEqual(f.queries,[]);
});
