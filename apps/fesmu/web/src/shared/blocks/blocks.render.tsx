import type { FC } from "react";
import type { BlockSpec } from "./blocks.registry";
import { BLOCKS } from "./blocks.registry";
import type { Block, BlockKind } from "./blocks.types";

const spec = <K extends BlockKind>(kind: K) => BLOCKS[kind] as unknown as BlockSpec<BlockKind>;

/** Просмотр любого блока. */
export const BlockView: FC<{ block: Block }> = ({ block }) => {
    const { View } = spec(block.kind);
    return <View block={block} />;
};

/** Правка любого блока. */
export const BlockEdit: FC<{ block: Block; onChange: (block: Block) => void }> = ({ block, onChange }) => {
    const { Edit } = spec(block.kind);
    return <Edit block={block} onChange={onChange} />;
};
