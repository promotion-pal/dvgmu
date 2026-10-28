import { useParams, useSearchParams } from "react-router-dom";
import { ManualReader } from "@/widgets/manual";

/** Методичка в кабинете. ?draft=1 — предпросмотр черновика (manuals.post). */
export default function ManualReadPage() {
    const { id = "" } = useParams();
    const [params] = useSearchParams();
    return <ManualReader id={id} draft={params.get("draft") === "1"} />;
}
