import { useParams } from "react-router-dom";
import { ManualEditor } from "@/widgets/manual";

/** Редактор методички (manuals.post): темы, блоки, публикация. */
export default function ManualEditorPage() {
    const { id = "" } = useParams();
    return <ManualEditor key={id} id={id} />;
}
