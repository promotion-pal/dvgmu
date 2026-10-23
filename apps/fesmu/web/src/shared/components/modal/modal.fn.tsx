import type { ReactNode} from "react";
import { useState } from "react";

export type DefaultModalType = "view" | "create" | "update";
// index.ts has re-exported this name for a while (several models already import it) — it just
// never existed here, so useCommonModal({ initialType: "create" }) silently inferred its type
// param as the literal "create" instead of the full view|create|update union, and any later
// openModal("update"/"view") call became a type error a few call sites down the line.
export type CommonModalType = DefaultModalType;

export type CommonModalConfig<T extends string = DefaultModalType> = Record<
  T,
  {
    title: string;
    description: string;
    component: ReactNode;
  }
>

interface UseModalProps<T extends string> {
  fnOpen?: (id?: bigint) => void;
  initialType?: T;
}

interface ModalState<T extends string> {
  isOpen: boolean;
  type: T;
}

const useCommonModal = <T extends string = DefaultModalType>({
  fnOpen,
  initialType
}: UseModalProps<T> = {}) => {
  const defaultType = initialType || ("view" as T);

  const [modal, setModal] = useState<ModalState<T>>({
    isOpen: false,
    type: defaultType,
  });

  const openModal = (type: T, id?: bigint) => {
    setModal({
      isOpen: true,
      type: type,
    });

    if (fnOpen) fnOpen(id);
  };

  const closeModal = () => {
    setModal({
      isOpen: false,
      type: defaultType,
    });
  };

  const onOpenChange = (open: boolean) => {
    setModal((prev) => ({
      ...prev,
      isOpen: open,
    }));
  };

  return {
    setModal,
    openModal,
    closeModal,
    onOpenChange,
    state: modal,
    type: modal.type,
    open: modal.isOpen,
  };
};

export { useCommonModal };
