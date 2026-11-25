export type StatementSettings = {specialty: string; semester?: number; academic_year?: string; season?: string};
export type StatementStudent = {
 id: number; session_id: number; name: string; group: string; percent: number; grade: number; rank: number;
 test_title?: string; test_id?: number; settings: StatementSettings;
};
export type StatementReport = {title: string; settings?: StatementSettings; students: StatementStudent[]};
export const escapeStatement = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const decimal = (value: number) => new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 2}).format(value);
export const gradeLabel = (grade: number) => ({5:"Отлично",4:"Хорошо",3:"Удовл.",2:"Неудовл."}[grade] ?? "—");
export function statementStudents<T extends StatementStudent>(students: T[], groups?: string[]): T[] {
 return students.filter(s => !groups || groups.includes(s.group)).sort((a,b) => b.percent-a.percent || a.name.localeCompare(b.name,"ru") || a.session_id-b.session_id || a.id-b.id).map((s,index) => ({...s,rank:index+1}));
}
function summaryRow(label: string, students: StatementStudent[]): string {
 const n=students.length;
 const average=(get:(s:StatementStudent)=>number) => n ? students.reduce((sum,s)=>sum+get(s),0)/n : 0;
 return `<tr><td>${escapeStatement(label)}</td><td>${decimal(average(s=>s.percent))}%</td><td>${decimal(average(s=>s.grade))}</td>${[5,4,3,2].map(g=>{const count=students.filter(s=>s.grade===g).length;return `<td>${count}(${decimal(n ? count/n*100 : 0)}%)</td>`;}).join("")}</tr>`;
}
export const statementCss = `
/* Word lets the wider summary table extend into the right margin.
   Reserve the table overhang, while keeping the text at the original 30mm left margin, to prevent browsers shrinking or clipping the 10pt content. */
@page {size:A4 portrait;margin:20mm 13mm 20mm 28.1mm}
html,body {margin:0;padding:0;background:#fff;color:#000}
body {width:168.8mm;font-family:"Times New Roman",Times,serif;font-size:10pt;line-height:11.55pt}
* {box-sizing:border-box}
p,h1 {margin:0;font-size:10pt;line-height:11.55pt}
h1 {text-align:center;font-weight:bold;width:165mm;margin-left:5.4pt}
.statement {break-after:page;page-break-after:always}
.statement:last-child {break-after:auto;page-break-after:auto}
.variant {font-weight:bold;margin-left:5.4pt}
table {border-collapse:collapse;table-layout:fixed;width:165mm;font:inherit}
th,td {border:.5pt solid #000;padding:0 5.4pt;vertical-align:top;line-height:11.55pt;font-size:10pt;overflow-wrap:break-word}
th {text-align:center;font-weight:bold}
.students td:nth-child(n+3), .summary td:nth-child(n+2) {text-align:center}
.students th:nth-child(1) {width:9.72%}.students th:nth-child(2) {width:51.39%}.students th:nth-child(3) {width:12.91%}.students th:nth-child(4) {width:15.96%}.students th:nth-child(5) {width:10.02%}
.summary {margin-top:10pt;width:168.8mm}
.summary th:nth-child(1),.summary th:nth-child(2) {width:14.29%}.summary th:nth-child(3) {width:16.72%}.summary th:nth-child(4) {width:13.58%}.summary th:nth-child(5) {width:12.54%}.summary th:nth-child(6),.summary th:nth-child(7) {width:14.29%}
thead {display:table-header-group}tr {break-inside:avoid;page-break-inside:avoid}
.signatures {margin-top:10pt;margin-left:5.4pt;break-inside:avoid;page-break-inside:avoid}.dean {margin-top:10pt}
`;
export function statementBody(report: StatementReport, groups?: string[]): string {
 const students=statementStudents(report.students,groups);
 const sections=new Map<string,{title:string;settings:StatementSettings;students:StatementStudent[]}>();
 for (const s of students) {
  const settings=s.settings ?? report.settings ?? {specialty:""};
  const title=s.test_title || report.title;
  const key=JSON.stringify([s.test_id ?? title,settings.specialty,settings.semester,settings.academic_year,settings.season]);
  if(!sections.has(key)) sections.set(key,{title,settings,students:[]});
  sections.get(key)!.students.push(s);
 }
 if(!sections.size) sections.set("empty",{title:report.title,settings:report.settings ?? {specialty:""},students:[]});
 return [...sections.values()].map(section=>{
  const rows=statementStudents(section.students);
  const heading=`Ведомость тестирования${section.settings.semester ? ` за ${section.settings.semester} семестр` : ""}${section.settings.specialty ? ` по специальности ${section.settings.specialty}` : ""}`;
  const groupNames=[...new Set(rows.map(s=>s.group))].sort((a,b)=>a.localeCompare(b,"ru",{numeric:true}));
  return `<section class="statement"><h1>${escapeStatement(heading)}</h1><p class="variant">Вариант теста: &nbsp;${escapeStatement(section.title)}</p><table class="students"><thead><tr>${["Группа","Ф. И. О.","Правильно","Оценка","Рейтинг"].map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(s=>`<tr><td>${escapeStatement(s.group)}</td><td>${escapeStatement(s.name.toLocaleUpperCase("ru-RU"))}</td><td>${Math.round(s.percent)}%</td><td>${gradeLabel(s.grade)}</td><td>${s.rank}</td></tr>`).join("")}</tbody></table><table class="summary"><thead><tr>${["Группа","Правильно","Средний балл","Отлично","Хорошо","Удовлетв.","Неудовл."].map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${groupNames.map(group=>summaryRow(group,rows.filter(s=>s.group===group))).join("")}${summaryRow("По варианту",rows)}</tbody></table><div class="signatures"><p>Начальник сектора цифрового сопровождения</p><p>образовательного процесса УИТиС</p><p class="dean">Декан факультета</p></div></section>`;
 }).join("");
}
export function statementDocument(report: StatementReport, groups?: string[]): string {
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeStatement(report.title)}</title><style>${statementCss}</style></head><body>${statementBody(report,groups)}</body></html>`;
}
