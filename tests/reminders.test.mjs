import test from 'node:test';import assert from 'node:assert/strict';
import {SummitReminder,REMINDER_MS} from '../src/reminders.mjs';
const state={home:true,ready:true,finished:false,beer:true,missed:false,mobile:true};
test('summit reminder waits five active seconds, appears once and never invents a missed photo',()=>{
 const reminder=new SummitReminder();assert.equal(reminder.update(1000,{...state,home:false}),null);
 assert.equal(reminder.update(10000,state),null);assert.equal(reminder.update(14999,state),null);
 assert.equal(reminder.update(15000,state),'Use Action to deliver the six-pack & finish');
 assert.equal(reminder.update(16000,state),null);assert.equal(reminder.update(30000,{...state,missed:true}),null);
 assert.ok(REMINDER_MS>=1000&&REMINDER_MS<=2000);
});
test('summit waits for voice and return, suppresses finished runs and recalls only real missing photos',()=>{
 const reminder=new SummitReminder();reminder.update(1000,state);
 assert.equal(reminder.update(6000,{...state,ready:false}),null);
 assert.equal(reminder.update(7000,{...state,home:false}),null);
 assert.equal(reminder.update(8000,{...state,finished:true}),null);
 assert.match(reminder.update(9000,{...state,missed:true}),/Menu → Recall missed photo/);
 const keyboard=new SummitReminder();keyboard.update(0,state);
 assert.match(keyboard.update(5000,{...state,mobile:false,missed:true,beer:false}),/Action to finish\nMissing photo: press B/);
});
