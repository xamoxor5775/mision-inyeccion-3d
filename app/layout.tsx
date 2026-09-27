import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Señal perdida | Misión Laboral 3D | Aula TP Chile",
  description:
    "Misión Laboral 3D de Mecánica Automotriz para diagnosticar una falla del sistema de inyección electrónica.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
