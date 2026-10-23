import { useState } from "react";
import {
  BookOpenIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  GraduationCapIcon,
  HomeIcon,
  IdCardIcon,
  MailIcon,
  PhoneIcon,
  UsersIcon,
} from "lucide-react";
import { FileGenerateType } from "@dvgmu/file/enum/file.enum_pb";
import { useCertificateOrder } from "@/features/certificate/certificate.fn";
import { useLoadUser } from "@/features/provider/user.provider";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonLoadingOverlay } from "@/shared/components/state";
import { PersonDetails } from "@/shared/components/person";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function StudentCabinet() {
  const { userId, profile, student, status } = useLoadUser();
  const { step, order, reset } = useCertificateOrder();
  const [open, setOpen] = useState(false);
  const [copies, setCopies] = useState(1);

  if (status !== "ready" || !profile) return null;

  const fullName = [profile.lastName, profile.firstName].filter(Boolean).join(" ");
  const initials = `${profile.lastName[0] ?? ""}${profile.firstName[0] ?? ""}`.toUpperCase();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCopies(1);
      reset();
    }
  };

  const handleSubmit = async () => {
    const success = await order(userId, FileGenerateType.WORD_GEN_APPLICATION_CERTIFICATE_ENROLLMENT, copies);
    if (success) handleOpenChange(false);
  };

  return (
    <CommonWrapper title="Личный кабинет" description="Ваши персональные данные">
      <div className="flex flex-col gap-6 max-w-3xl">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar size="lg">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            <div className="flex flex-col gap-1.5">
              <p className="text-base font-semibold text-slate-800">{fullName}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {student && <Badge variant="secondary">{student.status}</Badge>}
                <span className="icon-inline gap-1">
                  <MailIcon className="size-3" />
                  {profile.email}
                </span>
                {student?.phone && (
                  <span className="icon-inline gap-1">
                    <PhoneIcon className="size-3" />
                    {student.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {student && (
          <Card className="p-5">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Данные об обучении</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <PersonDetails
                rows={[
                  { icon: <UsersIcon className="size-4" />, label: "Группа", value: student.group },
                  { icon: <GraduationCapIcon className="size-4" />, label: "Факультет", value: student.faculty },
                  { icon: <ClockIcon className="size-4" />, label: "Курс", value: `${student.course} курс` },
                  { icon: <BookOpenIcon className="size-4" />, label: "№ зачётки", value: student.recordBook },
                  { icon: <IdCardIcon className="size-4" />, label: "Форма обучения", value: student.educationForm },
                  {
                    icon: <HomeIcon className="size-4" />,
                    label: "Общежитие",
                    value: student.needsDormitory ? "Требуется" : "Не требуется",
                  },
                  { icon: <CalendarIcon className="size-4" />, label: "Дата рождения", value: student.birthday },
                ]}
              />
            </CardContent>
          </Card>
        )}

        <Card className="p-5">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Услуги</CardTitle>
            <CardDescription>Закажите документ — он сформируется автоматически и сразу скачается</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="icon-inline gap-3">
                <FileTextIcon className="size-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Справка об обучении</p>
                  <p className="text-xs text-muted-foreground">Для предъявления по месту требования</p>
                </div>
              </div>
              <Button onClick={() => setOpen(true)}>Заказать справку</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          {step === "loading" ? (
            <CommonLoadingOverlay
              title="Формируем справку..."
              description="Получаем данные студента и готовим документ"
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Заказ справки</DialogTitle>
                <DialogDescription>Справка об обучении — документ сформируется и сразу скачается</DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Тип справки</Label>
                  <p className="text-sm font-medium text-slate-800">Справка об обучении</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="certificate-copies">Количество экземпляров</Label>
                  <Input
                    id="certificate-copies"
                    type="number"
                    min={1}
                    max={10}
                    value={copies}
                    onChange={(event) => setCopies(Math.max(1, Number(event.target.value) || 1))}
                    className="w-24"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Отмена
                </Button>
                <Button onClick={handleSubmit}>Отправить заявку</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </CommonWrapper>
  );
}
