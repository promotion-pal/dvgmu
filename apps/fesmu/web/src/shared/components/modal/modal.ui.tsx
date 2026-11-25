import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import type { ComponentProps, FC, ReactNode } from "react";

interface CommonModalProps extends ComponentProps<typeof Dialog> {
  title?: string;
  children: ReactNode;
  description?: string;
  /** Extra classes for the dialog box, e.g. a wider max-width for a long form. */
  className?: string;
}
export const CommonModal: FC<CommonModalProps> = ({
  title = "Are you absolutely sure?",
  description = "This action cannot be undone. This will permanently delete your account and remove your data from our servers.",
  children,
  className,
  ...dialog
}) => {
  return (
    <Dialog {...dialog} >
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {children}
      </DialogContent>
    </Dialog>
  );
};
