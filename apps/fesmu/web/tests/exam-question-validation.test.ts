import assert from "node:assert/strict";
import test from "node:test";
import {existingQuestions,questionIdentity,registerImportedTopic} from "../src/page/exam-v2/question-validation.ts";
const q=()=>({text:"Выберите вещество",image:"",answers:[{text:"Натрий",isCorrect:true},{text:"Калий",isCorrect:false}]});

test("same stem with different answers or image is a different task",()=>{
 const first=q(),other=q(),picture=q();other.answers[1].text="Кальций";picture.image="a".repeat(64);
 const seen=existingQuestions([]);
 assert.doesNotThrow(()=>registerImportedTopic(seen,[first,other,picture],"Раздел","Файл"));
 assert.equal(seen.size,3);
});
test("charge signs and decimal punctuation remain significant",()=>{
 assert.notEqual(questionIdentity({...q(),text:"Заряд Na+"}),questionIdentity({...q(),text:"Заряд Na-"}));
 assert.notEqual(questionIdentity({...q(),text:"Доза 0,1 мг"}),questionIdentity({...q(),text:"Доза 01 мг"}));
});
test("existing bank duplicate names the old section and the new file",()=>{
 const bank=[{name:"Кардиология",topics:[{name:"Сохранённая тема",questions:[q()]}]}];
 const seen=existingQuestions(bank);
 assert.throws(()=>registerImportedTopic(seen,[q()],"Готовый раздел","Новый файл"),error=>{
  assert.ok(error instanceof Error);
  for(const text of ["Кардиология","Сохранённая тема","Готовый раздел","Новый файл","№1"])assert.ok(error.message.includes(text));
  return true;
 });
 // An independent discipline must not inherit the first bank's registry.
 assert.doesNotThrow(()=>registerImportedTopic(existingQuestions([]),[q()],"Другая дисциплина","Файл"));
});
test("duplicate inside one file names both question indices even if choices reordered",()=>{
 const second=q();second.text=" ВЫБЕРИТЕ   вещество ";second.answers.reverse();
 assert.throws(()=>registerImportedTopic(existingQuestions([]),[q(),second],"Раздел","Файл"),error=>{
  assert.ok(error instanceof Error);assert.ok(error.message.includes("№1"));assert.ok(error.message.includes("№2"));return true;
 });
});
test("a changed correct-answer mark is a conflict, not another independent task",()=>{
 const first=q(),second=q();second.answers=second.answers.map(a=>({...a,isCorrect:!a.isCorrect}));
 assert.throws(()=>registerImportedTopic(existingQuestions([]),[first,second],"Раздел","Файл"),/Разметка правильного ответа отличается/);
});
