export const appConfig = {
  name: "Клиника семейной медицины",
  fullName:
    "Консультативно-диагностическая поликлиника «Клиника семейной медицины»",
  legalName:
    "Консультативно-диагностическая поликлиника «Клиника семейной медицины» — структурное подразделение ФГБОУ ВО «Дальневосточный государственный медицинский университет» Минздрава России",
  parentOrg:
    "ФГБОУ ВО «Дальневосточный государственный медицинский университет» Министерства здравоохранения Российской Федерации",
  tagline:
    "Консультативно-диагностическая помощь по принципу семейной медицины — клиническая база ДВГМУ в Хабаровске.",
  founded: {
    year: 1996,
    order: "приказ Минздрава России № 31 от 25 января 1996 г.",
  },
  license: "№ ФС-27-01-000824 от 24 мая 2018 г.",
  address: {
    full: "680000, г. Хабаровск, ул. Карла Маркса, 60",
    short: "ул. Карла Маркса, 60",
    city: "г. Хабаровск",
    postcode: "680000",
    landmark: "остановка «Площадь Ленина»",
  },
  coords: { lat: 48.481574, lng: 135.072594 },
  map2gis:
    "https://2gis.ru/khabarovsk/geo/135.072594%2C48.481574",
  phones: [
    { number: "8 (4212) 32-76-76", label: "Регистратура" },
    { number: "8 (4212) 30-32-99", label: "Регистратура" },
    { number: "8 (4212) 30-34-08", label: "Заведующая регистратурой" },
    { number: "8 (4212) 31-68-30", label: "Администратор для страховых компаний" },
    { number: "8 (4212) 30-34-74", label: "Приёмная главного врача" },
  ],
  email: "fmc@mail.fesmu.ru",
  telegram: "https://t.me/+ZbQih93Y3dtlZWMy",
  schedule: [
    { day: "Понедельник — пятница", hours: "08:00 – 20:00" },
    { day: "Суббота", hours: "09:00 – 14:00" },
    { day: "Воскресенье", hours: "выходной" },
  ],
  chief: {
    name: "Чибисов Юрий Владимирович",
    position: "Главный врач",
    quote:
      "Мы объединяем профессиональную компетентность и современные методы лечения, сохраняя внимательное, семейное отношение к каждому пациенту.",
  },
  source: "https://клиника-дв.рф",
  priceListUrl: "https://клиника-дв.рф/images/prajs24.pdf",
  staffListUrl: "https://клиника-дв.рф/images/42235.xlsx",
} as const;

export type NavItem = {
  title: string;
  href: string;
  description?: string;
};

export const primaryNav: NavItem[] = [
  { title: "О клинике", href: "/about", description: "Сведения о медицинской организации" },
  { title: "Услуги", href: "/services", description: "Направления помощи и платные услуги" },
  { title: "Программы", href: "/programs", description: "Комплексные лечебно-диагностические программы" },
  { title: "Пациентам", href: "/patients", description: "Права, диспансеризация, страхование" },
  { title: "Специалистам", href: "/specialists", description: "Порядки, стандарты, клинические рекомендации" },
  { title: "Врачи", href: "/doctors", description: "Медицинские работники поликлиники" },
  { title: "Новости", href: "/news", description: "События клиники" },
  { title: "Контакты", href: "/contacts", description: "Адрес, телефоны, схема проезда" },
];

export const footerNav: NavItem[] = [
  { title: "О клинике", href: "/about" },
  { title: "Услуги", href: "/services" },
  { title: "Комплексные программы", href: "/programs" },
  { title: "Пациентам", href: "/patients" },
  { title: "Территориальная программа", href: "/patients/program" },
  { title: "Диспансеризация", href: "/patients/screening" },
  { title: "Страховые организации", href: "/patients/insurance" },
  { title: "Вопрос-ответ", href: "/patients/faq" },
  { title: "Специалистам", href: "/specialists" },
  { title: "Врачи", href: "/doctors" },
  { title: "Лекарственное обеспечение", href: "/medication" },
  { title: "Контролирующие органы", href: "/oversight" },
  { title: "Документы", href: "/documents" },
  { title: "Новости", href: "/news" },
  { title: "Отзывы", href: "/reviews" },
  { title: "Вакансии", href: "/vacancies" },
  { title: "Запись на приём", href: "/appointment" },
  { title: "Контакты", href: "/contacts" },
];
