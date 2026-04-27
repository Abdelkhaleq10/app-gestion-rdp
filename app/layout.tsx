import "./globals.css";

export const metadata = {
  title: "Gestion d'acces RDP",
  description: "Application web de gestion d'acces au PC principal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}