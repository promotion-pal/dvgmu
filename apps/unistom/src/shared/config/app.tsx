export const appConfig = {
  name: "Уни-Стом",
  fullName:
    "Стоматологическая поликлиника «Уни-Стом» ФГБОУ ВО ДВГМУ Минздрава России",
  tagline: "Ищете врачей с опытом работы более 20 лет?! Тогда вам к нам!",
  parentOrg: "ФГБОУ ВО «Дальневосточный государственный медицинский университет» Минздрава России",
  address: {
    full: "680000, Россия, Хабаровский край, г. Хабаровск, ул. Муравьёва-Амурского, 30",
    city: "г. Хабаровск",
    street: "ул. Муравьёва-Амурского, 30",
    postcode: "680000",
  },
  coords: { lat: 48.47659141612059, lng: 135.0644373893738 },
  phones: {
    registry: ["(4212) 32-46-15", "+7 (929) 402-63-62"],
    reception: "(4212) 32-64-92",
    chief: "(4212) 30-58-17",
    chiefDoctor: "(4212) 30-58-17",
  },
  email: "info@uni-stom.ru",
  schedule: {
    weekdays: "Пн–Пт: 8:00–20:00",
    saturday: "Сб: 8:00–14:00",
    sunday: "Вс: выходной",
  },
  chief: {
    name: "Чабан Александр Владимирович",
    position: "Главный врач, кандидат медицинских наук, доцент",
  },
  transport: {
    bus: ["4", "14", "52", "55", "56", "10", "34", "107"],
    trolleybus: ["1"],
    minibus: ["61", "82", "88", "89", "73"],
    stops: ["Театр драмы и комедии", "к/т «Совкино»", "Ж/Д Управление"],
  },
  source: "https://унистом.рф",
} as const;

export type NavItem = {
  title: string;
  href: string;
  description?: string;
};

export const primaryNav: NavItem[] = [
  { title: "О поликлинике", href: "/about", description: "Сведения о медицинской организации" },
  { title: "Услуги", href: "/services", description: "Виды медицинской помощи и платные услуги" },
  { title: "Пациентам", href: "/patients", description: "Бюджетная помощь, права, график работы" },
  { title: "Специалистам", href: "/specialists", description: "Порядки, стандарты, клинические рекомендации" },
  { title: "Врачи", href: "/doctors", description: "Медицинские работники организации" },
  { title: "Новости", href: "/news", description: "События поликлиники" },
  { title: "Контакты", href: "/contacts", description: "Адрес, телефоны, схема проезда" },
];

export const footerNav: NavItem[] = [
  { title: "О поликлинике", href: "/about" },
  { title: "Услуги", href: "/services" },
  { title: "Пациентам", href: "/patients" },
  { title: "Вопрос-ответ", href: "/patients/faq" },
  { title: "Специалистам", href: "/specialists" },
  { title: "Врачи", href: "/doctors" },
  { title: "Вакансии", href: "/vacancies" },
  { title: "Контролирующие органы", href: "/oversight" },
  { title: "Документы", href: "/documents" },
  { title: "Статьи", href: "/articles" },
  { title: "Новости", href: "/news" },
  { title: "Отзывы", href: "/reviews" },
  { title: "Запись на приём", href: "/appointment" },
  { title: "Контакты", href: "/contacts" },
];
