import assert from "node:assert/strict";
import test from "node:test";
import {statementDocument, statementStudents, type StatementStudent} from "../src/page/exam-v2/statement.ts";
const student=(id:number,group:string,percent:number,grade:number,session_id=id):StatementStudent=>({id,session_id,name:`Студент ${id}`,group,percent,grade,rank:99,test_title:"Тест 06",settings:{specialty:"Сестринское дело",semester:3}});
test("selected groups across sessions receive one common ranking without mutating results",()=>{
 const original=[student(1,"101",70,3),student(2,"102",95,5),student(3,"103",80,4),student(4,"101",85,4)];
 const rows=statementStudents(original,["101","102"]);
 assert.deepEqual(rows.map(s=>[s.id,s.rank]),[[2,1],[4,2],[1,3]]);
 assert.ok(original.every(s=>s.rank===99));
 const html=statementDocument({title:"Тест 06",students:original},["101","102"]);
 assert.equal((html.match(/<section class="statement">/g)??[]).length,1);
 assert.ok(!html.includes("СТУДЕНТ 3"));
 assert.match(html, /<td>По варианту<\/td><td>83,33%<\/td><td>4<\/td>/);
 assert.ok(html.includes("Удовл.")&&html.includes("Отлично")&&html.includes("Хорошо"));
});
test("saved grades are printed unchanged even when percentage would suggest another scale",()=>{
 const html=statementDocument({title:"Тест 06",students:[student(1,"101",85,3)]});
 assert.match(html,/<td>85%<\/td><td>Удовл\.<\/td>/);
});
test("different tests are not mixed into one sheet and data is escaped",()=>{
 const a=student(1,"101",70,2),b={...student(2,"101",90,4),test_title:"Другой тест"};
 a.name='<script>alert("x")</script>';
 const html=statementDocument({title:"Сводный отчёт",students:[a,b]});
 assert.equal((html.match(/<section class="statement">/g)??[]).length,2);
 assert.ok(!html.includes("<script>"));assert.ok(html.includes("&lt;SCRIPT&gt;"));
});

test("identical titles from different test identities stay in separate sheets",()=>{
 const a={...student(1,"101",80,4),test_id:10},b={...student(2,"102",90,5),test_id:20};
 const html=statementDocument({title:"Тест 06",students:[a,b]});
 assert.equal((html.match(/<section class="statement">/g)??[]).length,2);
});
