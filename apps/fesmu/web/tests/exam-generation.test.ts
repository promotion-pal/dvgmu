import assert from "node:assert/strict";
import test from "node:test";
import {generationBlocker,generateSavedVariants} from "../src/page/exam-v2/generation.ts";
const bank=()=>({id:5n,revision:2n,approvedBy:"specialist",reviewNotes:"Проверено УМР"});
test("unsaved bank is saved before generating with the returned identity",async()=>{
 const calls:string[]=[];
 const result=await generateSavedVariants({...bank(),id:0n,revision:0n},false,{
  save:async b=>{calls.push("save");return {...b,id:8n,revision:1n}},
  generate:async(id,revision)=>{calls.push(`generate:${id}:${revision}`);return [{id:1n}]},
 });
 assert.deepEqual(calls,["save","generate:8:1"]);assert.equal(result.bank.id,8n);assert.equal(result.variants.length,1);
});
test("dirty saved bank is saved with a new revision before generation",async()=>{
 let saved=false;
 await generateSavedVariants(bank(),true,{
  save:async b=>{saved=true;return {...b,revision:3n}},
  generate:async(id,revision)=>{assert.ok(saved);assert.equal(id,5n);assert.equal(revision,3n);return [1]},
 });
});
test("clean approved bank generates without a redundant save",async()=>{
 await generateSavedVariants(bank(),false,{save:async()=>assert.fail("unexpected save"),generate:async()=>[1]});
});
test("review and AI metadata do not block saving or generation",async()=>{
 const b={...bank(),approvedBy:"",reviewNotes:"",aiReviewNotes:""};assert.equal(generationBlocker(b),undefined);
 const result=await generateSavedVariants(b,true,{save:async draft=>({...draft,revision:3n}),generate:async()=>[1]});
 assert.deepEqual(result.variants,[1]);
 assert.match(generationBlocker(undefined)??"",/Выберите банк/);
});
test("failed save never starts generation",async()=>{
 await assert.rejects(generateSavedVariants(bank(),true,{save:async()=>{throw new Error("save rejected")},generate:async()=>assert.fail("unexpected generation")}),/save rejected/);
});
test("empty generation response is not presented as success",async()=>{
 await assert.rejects(generateSavedVariants(bank(),false,{save:async b=>b,generate:async()=>[]}),/не вернул/);
});
