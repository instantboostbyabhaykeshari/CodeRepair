import "./globals.css";

export const metadata = {
  title: "CodeRepair | GitHub Issue Solver",
  description: "Follow an AI agent from GitHub issue to an approved draft pull request.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 font-sans text-sm text-slate-200 antialiased selection:bg-indigo-500/30">
        {children}
      </body>
    </html>
  );
}
