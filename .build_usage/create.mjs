import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
const p=Presentation.create({slideSize:{width:1280,height:720}});
const s=p.slides.add(); s.background.fill='#F5F7FA';
function box(text,x,y,w,h,size,color,bold=false){const sh=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{style:'solid',fill:'none',width:0}});sh.text=text;sh.text.style={fontFamily:'Arial',fontSize:size,color,bold};return sh;}
box('Использование модуля закупок',72,52,1120,60,38,'#102A43',true);
box('ДВГМУ · штатная численность на 6 июля 2026 года',74,112,1100,30,17,'#526579');
box('6',76,196,320,155,112,'#087E8B',true);
box('сотрудников используют программу',82,337,370,55,23,'#102A43',true);
box('0,89% от 675 сотрудников университета',82,392,430,39,18,'#526579');
// Usage bar representing 6 / 803
s.shapes.add({geometry:'rect',position:{left:82,top:467,width:1080,height:22},fill:'#D9E2EC',line:{style:'solid',fill:'none',width:0}});
s.shapes.add({geometry:'rect',position:{left:82,top:467,width:9,height:22},fill:'#087E8B',line:{style:'solid',fill:'none',width:0}});
box('6 используют',82,502,240,34,19,'#087E8B',true); box('669 не используют',834,502,328,34,19,'#526579',true);
box('Пользователи по службам',82,579,480,34,22,'#102A43',true);
box('ИТС',82,625,250,30,18,'#526579'); box('4 человека',330,625,225,30,18,'#102A43',true);
box('Научный отдел',570,625,250,30,18,'#526579'); box('1 человек',830,625,170,30,18,'#102A43',true);
box('Проректор',1010,625,150,30,18,'#526579'); box('1',1165,625,70,30,18,'#102A43',true);
box('Расчёт: 675 сотрудников университета указаны пользователем; 6 используют программу, 669 не используют.',82,678,1110,22,12,'#64748B');
const pptx=await PresentationFile.exportPptx(p); await pptx.save('.build_usage/draft.pptx');
const png=await p.export({slide:s,format:'png',scale:1}); await fs.writeFile('.build_usage/slide.png',new Uint8Array(await png.arrayBuffer()));
