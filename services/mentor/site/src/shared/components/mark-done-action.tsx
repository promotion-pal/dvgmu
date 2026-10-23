"use client";

import { ActionMenu, ActionMenuItem } from "@/shared/components/action-menu";
import { CheckCircle2, MailIcon, RotateCcw } from "lucide-react";

interface MarkDoneActionProps {
  email: string;
  isDone: boolean;
  onToggle: (done: boolean) => void | Promise<void>;
}

const REPLY_SUBJECT = "ОТВЕТ тех поддержки ИНПОА";
const REPLY_BODY = `Здравствуйте!
Благодарим за обращение.



С уважением, команда ИНПОА ДВГМУ
`;

const buildReplyMailto = (email: string) =>
  `mailto:${email}?subject=${encodeURIComponent(REPLY_SUBJECT)}&body=${encodeURIComponent(REPLY_BODY)}`;

export function MarkDoneAction({ isDone, email, onToggle }: MarkDoneActionProps) {
  return (
    <ActionMenu label="Действия с заявкой">
      <ActionMenuItem
        icon={
          isDone ? <RotateCcw className="size-4" /> : <CheckCircle2 className="size-4" />
        }
        onClick={() => onToggle(!isDone)}
      >
        {isDone ? "Вернуть в работу" : "Отметить выполненной"}
      </ActionMenuItem>

      <ActionMenuItem
        icon={<MailIcon className="size-4" />}
        onClick={() => {
          window.location.href = buildReplyMailto(email);
        }}
      >
        Отправить письмо
      </ActionMenuItem>
    </ActionMenu>
  );
}
