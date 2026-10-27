import type { DeaneryActivationCode } from "@fesmu/contract/fesmu/service/v1/deanery.service_pb";
import { formatDate } from "@/features/utils/date";
import { ENV } from "@/shared/config/env";

const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Лист кодов первого входа: страница на группу, строка на студента. Строку
 * можно отрезать и отдать студенту — в ней логин, код и срок.
 */
const sheetHtml = (codes: DeaneryActivationCode[], faculty: string) => {
    const portal = window.location.origin.replace(/^https?:\/\//, "");
    const activate = `${ENV.AUTH.replace(/^https?:\/\//, "")}/activate`;
    const issued = codes.filter((c) => c.code);
    const byGroup = new Map<string, DeaneryActivationCode[]>();
    for (const c of issued) {
        const key = c.group || "—";
        byGroup.set(key, [...(byGroup.get(key) ?? []), c]);
    }
    const today = new Date().toLocaleDateString("ru-RU");

    const pages = [...byGroup.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, list]) => {
            const rows = list
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map(
                    (c, i) => `<tr>
<td class="n">${i + 1}</td>
<td>${esc(c.fullName)}</td>
<td class="mono">${esc(c.login)}</td>
<td class="mono code">${esc(c.code)}</td>
<td class="exp">${esc(formatDate("datetime", c.expiresAt))}</td>
</tr>`,
                )
                .join("");
            return `<section class="page">
<header>
  <div class="org">ФГБОУ ВО ДВГМУ Минздрава России · Личный кабинет студента</div>
  <h1>Группа ${esc(group)}</h1>
  <div class="meta">${esc(faculty)}${faculty ? " · " : ""}выдано ${today} · студентов: ${list.length}</div>
</header>
<ol class="howto">
  <li>Откройте портал <b>${esc(portal)}</b> и нажмите «Первый вход по коду» (или сразу <b>${esc(activate)}</b>).</li>
  <li>Введите <b>логин</b> и <b>код</b> из своей строки.</li>
  <li>Задайте свой пароль по подсказке на экране. Дальше входите по логину и паролю.</li>
</ol>
<table>
<thead><tr><th class="n">№</th><th>ФИО</th><th>Логин</th><th>Код первого входа</th><th>Действует до</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p class="note">Код одноразовый и личный. Не передавайте его другим. Код истёк или потерян — обратитесь в деканат за новым; прежний код перестанет действовать.</p>
</section>`;
        })
        .join("");

    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Коды первого входа</title>
<style>
@page{size:A4;margin:14mm 12mm}
*{box-sizing:border-box}
body{font:12px/1.4 "Segoe UI",Arial,sans-serif;color:#000;margin:0}
.page{page-break-after:always}
.page:last-child{page-break-after:auto}
.org{font-size:11px;color:#444}
h1{font-size:20px;margin:4px 0 2px}
.meta{font-size:11px;color:#444;margin-bottom:8px}
.howto{margin:0 0 10px;padding-left:18px}
.howto li{margin:2px 0}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;border-bottom:1.5px solid #000;padding:4px 6px}
td{padding:9px 6px;border-bottom:1px dashed #888;vertical-align:middle}
tr{page-break-inside:avoid}
.n{width:28px;color:#555}
.mono{font-family:"Consolas","Courier New",monospace;font-size:13px}
.code{font-size:15px;font-weight:700;letter-spacing:1px}
.exp{white-space:nowrap;font-size:11px}
.note{font-size:10.5px;color:#444;margin-top:10px}
</style></head><body>${pages}</body></html>`;
};

/** Печать листа через скрытый iframe — window.print() напечатал бы всю страницу. */
const printActivationSheet = (codes: DeaneryActivationCode[], faculty = "") => {
    if (!codes.some((c) => c.code)) return;
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position: "absolute", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) return;
    win.document.open();
    win.document.write(sheetHtml(codes, faculty));
    win.document.close();
    win.onafterprint = () => iframe.remove();
    setTimeout(() => {
        win.focus();
        win.print();
    }, 100);
};

export { printActivationSheet };
