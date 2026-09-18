import "./globals.css";

export const metadata = {
  title: "CodeRepair | GitHub Issue Solver",
  description: "Investigate GitHub issues, review proposed fixes, and approve draft pull requests.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body className="bg-stone-50 font-sans text-sm text-stone-800 antialiased selection:bg-indigo-100">{children}</body></html>;
}
