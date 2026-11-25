import { useParams } from "react-router-dom";
import { ManualReader } from "@/widgets/manual";

/** Опубликованная методичка — открыто, без входа. */
export default function PublicManualReadPage() {
    const { id = "" } = useParams();
    return <ManualReader id={id} open />;
}
