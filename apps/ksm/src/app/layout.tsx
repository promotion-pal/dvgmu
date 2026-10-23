import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/shared/components/site-header";
import { SiteFooter } from "@/shared/components/site-footer";
import { appConfig } from "@/shared/config/app";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://клиника-дв.рф"),
  title: {
    default:
      "Клиника семейной медицины — консультативно-диагностическая поликлиника ДВГМУ в Хабаровске",
    template: "%s | Клиника семейной медицины",
  },
  description:
    "Консультативно-диагностическая поликлиника «Клиника семейной медицины» — структурное подразделение ДВГМУ Минздрава России в Хабаровске. Помощь по принципу семейной медицины: терапия, педиатрия, кардиология, неврология, эндокринология, гинекология, УЗИ, лаборатория, дневной стационар. По ОМС, ДМС и платно.",
  keywords: [
    "Клиника семейной медицины",
    "поликлиника ДВГМУ Хабаровск",
    "семейный врач Хабаровск",
    "консультативно-диагностическая поликлиника",
    "запись к врачу Хабаровск",
    "УЗИ Хабаровск",
    "дневной стационар ОМС",
    "диспансеризация Хабаровск",
  ],
  openGraph: {
    title: "Клиника семейной медицины — поликлиника ДВГМУ в Хабаровске",
    description:
      "Консультативно-диагностическая помощь по принципу семейной медицины. Хабаровск, ул. Карла Маркса, 60. Запись: 8 (4212) 32-76-76.",
    url: "https://клиника-дв.рф",
    siteName: "Клиника семейной медицины",
    locale: "ru_RU",
    type: "website",
  },
  robots: { index: true, follow: true },
  category: "health",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "MedicalClinic",
  name: appConfig.legalName,
  alternateName: appConfig.name,
  description:
    "Консультативно-диагностическая поликлиника, оказывающая амбулаторную помощь по принципу семейной медицины. Клиническая база ДВГМУ.",
  url: "https://клиника-дв.рф",
  telephone: "+7 (4212) 32-76-76",
  email: appConfig.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: "ул. Карла Маркса, 60",
    addressLocality: "Хабаровск",
    addressRegion: "Хабаровский край",
    postalCode: "680000",
    addressCountry: "RU",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: appConfig.coords.lat,
    longitude: appConfig.coords.lng,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "20:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday"],
      opens: "09:00",
      closes: "14:00",
    },
  ],
  parentOrganization: {
    "@type": "CollegeOrUniversity",
    name: "Дальневосточный государственный медицинский университет",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <meta name="geo.region" content="RU-KHA" />
        <meta name="geo.placename" content="Хабаровск" />
        <meta
          name="geo.position"
          content={`${appConfig.coords.lat};${appConfig.coords.lng}`}
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
