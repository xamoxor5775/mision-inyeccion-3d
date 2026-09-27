import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compresión perdida | Misión Laboral 3D | Aula TP Chile",
  description:
    "Misión Laboral 3D de Mecánica Automotriz para diagnosticar y ajustar el estado mecánico de un motor.",
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
