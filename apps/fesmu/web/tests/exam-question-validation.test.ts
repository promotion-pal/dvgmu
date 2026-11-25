import assert from "node:assert/strict";
import test from "node:test";
import {validateImportedTopic} from "../src/page/exam-v2/question-validation.ts";
const q=()=>({text:"Одинаковый вопрос",image:"",answers:[{text:"Да",isCorrect:true},{text:"Нет",isCorrect:false}]});
test("repeated questions and different answer keys do not block import",()=>{
 const changed=q();changed.answers=changed.answers.map(a=>({...a,isCorrect:!a.isCorrect}));
 assert.doesNotThrow(()=>validateImportedTopic([q(),q(),changed],"Раздел","Файл"));
});
test("exactly one correct answer is still required",()=>{
 for(const count of [0,2]){
  const invalid=q();invalid.answers=invalid.answers.map((a,i)=>({...a,isCorrect:i<count}));
  assert.throws(()=>validateImportedTopic([q(),invalid],"Раздел","Файл"),/вопрос №2: нужен ровно один правильный ответ/);
 }
});
