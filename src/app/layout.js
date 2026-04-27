import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CapacitorInit from "../components/CapacitorInit";
import KateChatWrapper from "../components/qbh/KateChatWrapper";
import SetupWizard from "../components/qbh/SetupWizard";
import PageIntro from "../components/qbh/PageIntro";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Quarterback Health",
  description: "Your healthcare, handled.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Script
          id="Cookiebot"
          src="https://consent.cookiebot.com/uc.js"
          data-cbid="bbddaf04-23e0-426e-b6ad-67ecd0bb15d8"
          strategy="beforeInteractive"
        />
        <Script id="gcm-defaults" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag("consent", "default", {
              ad_personalization: "denied",
              ad_storage: "denied",
              ad_user_data: "denied",
              analytics_storage: "denied",
              functionality_storage: "denied",
              personalization_storage: "denied",
              security_storage: "granted",
              wait_for_update: 500,
            });
            gtag("set", "ads_data_redaction", true);
            gtag("set", "url_passthrough", false);
          `}
        </Script>
        <script
          type="text/plain"
          data-cookieconsent="statistics"
          src="https://www.googletagmanager.com/gtag/js?id=G-T473FYH28S"
          async
        />
        <script
          type="text/plain"
          data-cookieconsent="statistics"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-T473FYH28S');
            `,
          }}
        />
        <CapacitorInit />
        {children}
        <KateChatWrapper />
        <SetupWizard />
        <PageIntro />
      </body>
    </html>
  );
}
