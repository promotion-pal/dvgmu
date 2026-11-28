import type { Issue } from "@fesmu/contract/schedula/entity/schedule.entity_pb";
import { IssueType } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import { dateLabel, eventTime } from "./schedula.utils";

export function SchedulaIssues({ issues }: { issues: Issue[] }) {
    return <ul className="space-y-2" aria-live="polite">{issues.map((issue, index) => <li key={index} className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-2 text-sm">
        <p className="font-medium">{issue.type === IssueType.TRAVEL_NORM_MISSING && "Предупреждение. "}{issue.message}</p>
        {[issue.event, issue.conflictingEvent].map((record, i) => record && <p key={i} className="text-xs text-muted-foreground">
            {record.title} · {dateLabel(record.date)} · {eventTime(record.startMinute, record.durationMinutes)}
        </p>)}
    </li>)}</ul>;
}
