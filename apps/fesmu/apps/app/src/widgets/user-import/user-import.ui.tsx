import { FormProvider } from "react-hook-form";
import { UploadIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { CommonModal } from "@/shared/components/modal";
import { PromFieldFile } from "@/features/lib/form";
import { IMPORT_KIND_LABEL, useUserImport } from "./user-import.fn";

const UserImportButton = () => {
    const { form, handleSubmit, submitting, result, kind, modal } = useUserImport();

    return (
        <>
            <button
                type="button"
                onClick={modal.openModal}
                title={`Загрузить из Excel: ${IMPORT_KIND_LABEL[kind]}`}
                className="icon-inline size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
                <UploadIcon className="size-4" />
            </button>

            <CommonModal
                open={modal.open}
                onOpenChange={modal.onOpenChange}
                title={`Импорт из Excel: ${IMPORT_KIND_LABEL[kind]}`}
                description="Загрузите файл — сервис файлов распознает строки и создаст записи в MDM."
            >
                <FormProvider {...form}>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <PromFieldFile
                            name="file"
                            label="Файл Excel"
                            placeholder="Выберите .xlsx файл"
                            accept=".xlsx,.xls"
                            preview={false}
                            disabled={submitting}
                        />

                        <Button type="submit" disabled={submitting} className="self-start">
                            {submitting ? "Загрузка…" : "Загрузить и создать"}
                        </Button>

                        {submitting && (
                            <p className="text-xs text-muted-foreground">
                                Идёт импорт — для большого файла это может занять около минуты. Не закрывайте окно.
                            </p>
                        )}
                    </form>
                </FormProvider>

                {result && (
                    <div className="mt-4 flex flex-col gap-3 border-t pt-4">
                        <p className="text-sm">
                            Создано: <strong>{result.createdCount}</strong>
                            {result.errors.length > 0 && (
                                <>
                                    {" "}· Ошибок: <strong>{result.errors.length}</strong>
                                </>
                            )}
                        </p>
                        {result.message && <p className="text-sm text-muted-foreground">{result.message}</p>}

                        {result.created.length > 0 && (
                            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                                {result.created.map((u, i) => (
                                    <div key={i} className="text-xs border rounded-lg p-2 flex flex-col gap-0.5">
                                        <span className="font-medium">
                                            {u.lastName} {u.firstName}
                                        </span>
                                        <span className="text-muted-foreground">{u.email}</span>
                                        {u.temporaryPassword && (
                                            <span className="font-mono">Временный пароль: {u.temporaryPassword}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {result.errors.length > 0 && (
                            <div className="flex flex-col gap-1">
                                {result.errors.map((e, i) => (
                                    <p key={i} className="text-xs text-destructive">
                                        {e.index >= 0 ? `Строка ${e.index + 1}: ` : ""}{e.message}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CommonModal>
        </>
    );
};

export { UserImportButton };
