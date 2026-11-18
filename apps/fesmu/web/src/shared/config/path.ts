/** Личный кабинет: всё, что открывается после входа, — под этим префиксом.
 *  Открытые страницы (PUBLIC, DOCS) — в корне сайта. */
const LK = "/lk";

const ROUTE = {
  HOME: LK,
  USER: {
    PROFILE: `${LK}/profile`,
    INFRASTRUCTURE: `${LK}/infrastructure`,
    INVENTORY: `${LK}/inventory`,
    USERS: `${LK}/users`,
    STUDENTS: `${LK}/students`,
    EMPLOYEES: `${LK}/employees`,
    TICKETS: `${LK}/tickets`,
  },
  /** Разделы студента внутри приложения (с меню). */
  MY: {
    CERTIFICATE: `${LK}/my/certificate`,
    SCHEDULE: `${LK}/my/schedule`,
  },
  STUDY: {
    SCHEDULE: `${LK}/study/schedule`,
    SCHEDULE_NEW: `${LK}/study/schedule/new`,
    SCHEDULE_EDIT: `${LK}/study/schedule/:id/edit`,
    SCHEDULE_HALL: `${LK}/study/schedule-hall`,
    COMPUTER_CLASS: `${LK}/study/computer-classes`,
  },
  TESTS: {
    BUILDER: `${LK}/tests/builder`,
    BUILDER_V2: `${LK}/tests/builder-v2`,
    SESSIONS: `${LK}/tests/sessions`,
    SESSION_RESULTS: `${LK}/tests/sessions/:id`,
  },
  EXAM_TESTS: {
 V2: `${LK}/exam-testing/v2`,
 MY_RESULTS: `${LK}/my/exam-results`,
    BUILDER: `${LK}/exam-testing`,
    SESSIONS: `${LK}/exam-testing/sessions`,
    SESSION_RESULTS: `${LK}/exam-testing/sessions/:id`,
  },
  PURCHASE: {
    V2: `${LK}/purchases/v2`,
    V3: `${LK}/purchases`,
  },
  /** Библиотека в кабинете: каталог — всем, кто вошёл; методички с черновиками
   *  и редактором. Опубликованные методички открыты и без входа — PUBLIC.MANUALS. */
  LIBRARY: {
    CATALOG: `${LK}/library`,
    ITEM: `${LK}/library/items/:id`,
    MANUALS: `${LK}/library/manuals`,
    MANUAL: `${LK}/library/manuals/:id`,
    MANUAL_EDIT: `${LK}/library/manuals/:id/edit`,
  },
  ANALYTICS: {
    /** Опросы (объекты с QR) и карточка опроса. */
    SURVEYS: `${LK}/analytics`,
    SURVEY: `${LK}/analytics/:id`,
    /** Универсальный отчёт по полям анкет. */
    REPORT: `${LK}/analytics/report`,
    REPORT_DETAIL: `${LK}/analytics/report/:id`,
    /** Сводка по категории (типу опроса): общая оценка + каждый объект. */
    REPORT_CATEGORY: `${LK}/analytics/report/type/:type`,
  },
  /** Деканат: студенты своего факультета и коды первого входа. */
  DEANERY: {
    STUDENTS: `${LK}/deanery/students`,
  },
  ADMIN: {
    CERTIFICATES: `${LK}/admin/certificates`,
    AUTH: `${LK}/admin/auth`,
    ROLES: `${LK}/admin/roles`,
    ACCESS: `${LK}/admin/access`,
    DEBTORS: `${LK}/admin/debtors`,
    VACCINATION: `${LK}/admin/vaccination`,
  },
  /** Pages open without a login, meant for students/visitors: no app-sidebar.
   * Read-only, except the forms anyone may fill in (collector, hall booking). */
  PUBLIC: {
    SCHEDULE: "/schedule",
    SCHEDULE_HALL: "/schedule/halls",
    HALL_BOOKING: "/schedule/halls/booking",
    COMPUTER_CLASS: "/schedule/computer-classes",
    VACCINATION: "/vaccination",
    CABINET: "/cabinet",
    SCHEDULE_COLLECT: "/schedule/collect",
    /** Опросник по QR (?qr=<номер>) — без входа; тот же путь, что в старых QR. */
    QUESTION: "/analytic",
    /** A student takes a test by its session link. */
    TEST_TAKE: "/tests/take/:token",
    EXAM_TEST_TAKE: "/exam-testing/take/:token",
    EXAM_TESTING: "/exam-testing",
    /** Опубликованные методички — без входа. */
    MANUALS: "/manuals",
    MANUAL: "/manuals/:id",
  },
  DOCS: {
    COMMON: "/docs",
    LEGAL: {
      GDPR: "/docs?doc=gdpr",
      TERMS: "/docs?doc=terms",
      COOKIE: "/docs?doc=cookie",
      PRIVACY: "/docs?doc=privacy",
      DISCLAIMER: "/docs?doc=disclaimer",
    },
  },
} as const;

/** Разделы кабинета по старым адресам (до /lk): ссылки и закладки на них
 *  переводим в кабинет. */
const LEGACY_LK_PREFIXES = [
  "/profile", "/infrastructure", "/inventory", "/users", "/students", "/employees", "/tickets",
  "/my", "/study", "/tests", "/exam-testing", "/purchases", "/library", "/analytics", "/deanery", "/admin",
] as const;

export { LEGACY_LK_PREFIXES, LK, ROUTE };
