import type { FC } from "react";
import { useState } from "react";
import { CheckIcon, Link2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";

interface CommonShareLinkProps {
  /** Defaults to the page's current address, query string included. */
  url?: string;
  label?: string;
  className?: string;
}

/** Copies a link to the clipboard — e.g. the current page with its filters,
 * to paste into an announcement. */
export const CommonShareLink: FC<CommonShareLinkProps> = ({ url, label = "Скопировать ссылку", className }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const link = url ?? window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Ссылка скопирована");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions): show the link to copy by hand.
      window.prompt("Скопируйте ссылку", link);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className={className}>
      {copied ? <CheckIcon className="size-4" /> : <Link2Icon className="size-4" />}
      {label}
    </Button>
  );
};
