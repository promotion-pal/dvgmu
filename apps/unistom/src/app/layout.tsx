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
// globals.css maps --font-sans → --font-sans and --font-mono → --font-geist-mono

export const metadata: Metadata = {
  metadataBase: new URL("https://унистом.рф"),
  title: {
    default:
      "Уни-Стом — стоматологическая поликлиника ДВГМУ в Хабаровске",
    template: "%s | Уни-Стом",
  },
  description:
    "Стоматологическая поликлиника «Уни-Стом» ФГБОУ ВО ДВГМУ Минздрава России в Хабаровске. Учебный, научный и лечебный комплекс. Помощь по ОМС и платно: терапия, ортопедия, хирургия, имплантация, ортодонтия, детская стоматология.",
  keywords: [
    "Уни-Стом",
    "стоматология Хабаровск",
    "стоматологическая поликлиника ДВГМУ",
    "лечение зубов Хабаровск",
    "протезирование",
    "имплантация зубов",
    "детская стоматология",
    "стоматология по ОМС",
  ],
  openGraph: {
    title: "Уни-Стом — стоматологическая поликлиника ДВГМУ",
    description:
      "Учебный, научный и лечебный комплекс — клиническая база стоматологического факультета ДВГМУ. Хабаровск, ул. Муравьёва-Амурского, 30.",
    url: "https://унистом.рф",
    siteName: "Уни-Стом",
    locale: "ru_RU",
    type: "website",
  },
  robots: { index: true, follow: true },
  category: "health",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Dentist",
  name: "Стоматологическая поликлиника «Уни-Стом» ФГБОУ ВО ДВГМУ Минздрава России",
  alternateName: "Уни-Стом",
  description:
    "Учебный, научный и лечебный комплекс — клиническая база стоматологического факультета ДВГМУ.",
  url: "https://унистом.рф",
  telephone: "+7 (4212) 32-46-15",
  email: appConfig.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: "ул. Муравьёва-Амурского, 30",
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
      opens: "08:00",
      closes: "14:00",
    },
  ],
  medicalSpecialty: "Dentistry",
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
