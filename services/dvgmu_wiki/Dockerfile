# Раздача заранее собранного Flutter web.
# Сам бандл (`flutter build web --release` → build/web/) собирается локально
# или в CI и коммитится в репозиторий — на сервер Flutter SDK не тянем
# (образ ~3 ГБ, забивает диск).
FROM nginx:1.27-alpine

COPY build/web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
