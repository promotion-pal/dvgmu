import { Link, useParams } from "react-router-dom";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState } from "@/shared/components/state/control-state";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { ScheduleEditorPanel, useScheduleEditor } from "@/widgets/schedule";

export default function ScheduleEditorPage() {
    const { id } = useParams();
    const editor = useScheduleEditor(id);

    return (
        <CommonWrapper
            title={editor.isEditing ? "Редактирование расписания" : "Новое расписание"}
            description="Заполните разделы по порядку: данные, сетка времени, предметы, занятия. Во вкладке «Предпросмотр» видно, как расписание будет выглядеть."
            action={
                <div className="flex items-center gap-2">
                    <Button asChild variant="outline">
                        <Link to={ROUTE.STUDY.SCHEDULE}>Отмена</Link>
                    </Button>
                    <Button disabled={editor.saving || editor.loading} onClick={editor.save}>
                        {editor.saving ? "Сохранение…" : "Сохранить"}
                    </Button>
                </div>
            }
        >
            <CommonControlState isLoading={editor.loading} isError={editor.error} isEmpty={false}>
                <ScheduleEditorPanel editor={editor} />
            </CommonControlState>
        </CommonWrapper>
    );
}
