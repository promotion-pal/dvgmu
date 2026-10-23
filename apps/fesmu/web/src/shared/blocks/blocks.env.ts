import { createContext, useContext } from "react";
import type { BlockFile, LiteratureRef } from "./blocks.types";

/* Блоки не знают об api: всё, что им нужно извне, даёт окружение — страница
 * методички (просмотр) или редактор. Так один и тот же компонент блока
 * работает в читалке, в предпросмотре и в редакторе. */
export interface BlocksEnv {
    /** Адрес файла для <img>/<a> (blob:), пока грузится — undefined. */
    useFileUrl: (file?: BlockFile) => string | undefined;
    /** Скачать файл под его именем. */
    download: (file: BlockFile) => void;
    /** Издания каталога по id — для блоков «Литература». */
    literature: Map<string, LiteratureRef>;
    /** Только в редакторе: загрузить файл для рисунка или вложения. */
    upload?: (file: File) => Promise<BlockFile>;
    /** Только в редакторе: весь каталог — выбрать литературу. */
    catalog?: LiteratureRef[];
}

const noop: BlocksEnv = {
    useFileUrl: () => undefined,
    download: () => {},
    literature: new Map(),
};

const BlocksEnvContext = createContext<BlocksEnv>(noop);

export const BlocksEnvProvider = BlocksEnvContext.Provider;

export const useBlocksEnv = () => useContext(BlocksEnvContext);
