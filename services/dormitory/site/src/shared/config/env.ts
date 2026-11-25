export const ENV = {
  // Относительный путь — запросы идут на тот же домен и проксируются
  // Next-ом (rewrites) в бэкенд-контейнер.
  API: process.env.NEXT_PUBLIC_API ?? "/api",
};
