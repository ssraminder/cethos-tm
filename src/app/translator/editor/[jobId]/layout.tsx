/**
 * Editor layout — breaks out of the AppShell's padded scroll container so
 * the editor can take the full viewport (minus the AppShell top bar +
 * sidebar) and split horizontally between segments and the bottom TM
 * matches panel.
 *
 * The trick: position the editor as a fixed overlay below the AppShell
 * top bar (h-14) and to the right of the AppShell sidebar (w-60 on lg+).
 * On smaller viewports the sidebar is hidden, so left-0 covers the full
 * width. Internal flex layout then distributes height correctly between
 * the editor header, filter bar, segments, and the bottom match panel.
 */
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed top-14 left-0 lg:left-60 right-0 bottom-0 flex flex-col bg-[color:var(--color-bg-app)] overflow-hidden">
      {children}
    </div>
  );
}
