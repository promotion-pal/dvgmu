import { appConfig } from "@/shared/config/app";
import { SidebarTrigger } from "@/shared/ui/sidebar";
import { Separator } from "@/shared/ui/separator";
import React, { createContext, useContext, useState } from "react";

interface HeaderContextType {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  setHeader: (
    title: string,
    description?: string,
    actions?: React.ReactNode,
  ) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export const HeaderProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [title, setTitle] = useState("ДВГМУ");
  const [description, setDescription] = useState<string | undefined>();
  const [actions, setActions] = useState<React.ReactNode | undefined>();

  const setHeader = (
    newTitle: string,
    newDesc?: string,
    newActions?: React.ReactNode,
  ) => {
    setTitle(newTitle);
    setDescription(newDesc);
    setActions(newActions);
  };

  return (
    <HeaderContext.Provider value={{ title, description, actions, setHeader }}>
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => {
  const context = useContext(HeaderContext);
  if (!context)
    throw new Error("useHeader должен использоваться внутри HeaderProvider");
  return context;
};

export const Header = () => {
  const { title, description, actions } = useHeader();

  return (
    <header className="w-full border-b bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-6" />

          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-wide text-foreground/60 uppercase">
                {appConfig.name}
              </span>
              <span className="text-muted-foreground/30 font-light">/</span>
              <h1 className="text-base font-bold text-foreground tracking-tight transition-all">
                {title}
              </h1>
            </div>

            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 transition-all">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions && (
            <div className="flex items-center gap-2 transition-all">
              {actions}
            </div>
          )}

        </div>
      </div>
    </header>
  );
};
