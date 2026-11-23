export type GeneratableBank={id:bigint;revision:bigint};
export function generationBlocker(bank:GeneratableBank|undefined):string|undefined{
 if(!bank)return "Выберите банк во вкладке «Банк и структура».";
 return undefined;
}
export async function generateSavedVariants<T extends GeneratableBank,V>(bank:T,dirty:boolean,api:{save:(bank:T)=>Promise<T>;generate:(id:bigint,revision:bigint)=>Promise<V[]>}):Promise<{bank:T;variants:V[]}>{
 const blocked=generationBlocker(bank);if(blocked)throw new Error(blocked);
 const saved=dirty||bank.id===0n?await api.save(bank):bank;
 const afterSave=generationBlocker(saved);if(afterSave)throw new Error(afterSave);
 const variants=await api.generate(saved.id,saved.revision);
 if(!variants.length)throw new Error("Сервис не вернул сформированные варианты. Обновите страницу и проверьте банк.");
 return {bank:saved,variants};
}
