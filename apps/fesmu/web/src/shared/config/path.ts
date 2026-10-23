const ROUTE = {
  HOME: "/",
  USER: {
    PROFILE: "/profile",
    INFRASTRUCTURE: "/infrastructure",
    INVENTORY: "/inventory",
    USERS: "/users",
    STUDENTS: "/students",
    EMPLOYEES: "/employees",
    TICKETS: "/tickets",
  },
  /** Разделы студента внутри приложения (с меню). */
  MY: {
    CERTIFICATE: "/my/certificate",
    SCHEDULE: "/my/schedule",
  },
  STUDY: {
    SCHEDULE: "/study/schedule",
    SCHEDULE_NEW: "/study/schedule/new",
    SCHEDULE_EDIT: "/study/schedule/:id/edit",
    SCHEDULE_HALL: "/study/schedule-hall",
    COMPUTER_CLASS: "/study/computer-classes",
  },
  TESTS: {
    BUILDER: "/tests/builder",
    BUILDER_V2: "/tests/builder-v2",
    SESSIONS: "/tests/sessions",
    SESSION_RESULTS: "/tests/sessions/:id",
  },
  PURCHASE: {
    V2: "/purchases/v2",
    V3: "/purchases",
  },
  /** Библиотека: каталог открыт всем, кто вошёл; методички — опубликованные. */
  LIBRARY: {
    CATALOG: "/library",
    ITEM: "/library/items/:id",
    MANUALS: "/library/manuals",
    MANUAL: "/library/manuals/:id",
    MANUAL_EDIT: "/library/manuals/:id/edit",
  },
  ANALYTICS: {
    /** Опросы (объекты с QR) и карточка опроса. */
    SURVEYS: "/analytics",
    SURVEY: "/analytics/:id",
    /** Универсальный отчёт по полям анкет. */
    REPORT: "/analytics/report",
    REPORT_DETAIL: "/analytics/report/:id",
    /** Сводка по категории (типу опроса): общая оценка + каждый объект. */
    REPORT_CATEGORY: "/analytics/report/type/:type",
  },
  ADMIN: {
    CERTIFICATES: "/admin/certificates",
    AUTH: "/admin/auth",
    ROLES: "/admin/roles",
    ACCESS: "/admin/access",
    DEBTORS: "/admin/debtors",
    VACCINATION: "/admin/vaccination",
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

export { ROUTE };
