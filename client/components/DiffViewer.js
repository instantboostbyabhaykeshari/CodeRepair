export default function DiffViewer({ diffs }) {
  return diffs.map(({ path: filePath, diff: fileDiff }) => (
    <section key={filePath} className="min-w-0 border-t border-slate-800">
      <h3 className="bg-slate-800/50 px-5 py-3 font-mono text-xs break-all text-slate-300">{filePath}</h3>
      <pre tabIndex={0} className="overflow-x-auto py-4 font-mono text-xs leading-6 [tab-size:4]" aria-label={"Proposed changes for " + filePath}>
        <code>
          {fileDiff.split("\n").map((codeLine, lineIndex) => {
            let lineColor = "text-slate-400";
            if (codeLine.startsWith("+")) lineColor = "bg-emerald-500/10 text-emerald-300";
            if (codeLine.startsWith("-")) lineColor = "bg-red-500/10 text-red-300";
            if (codeLine.startsWith("@@") || codeLine.startsWith("+++") || codeLine.startsWith("---")) lineColor = "bg-indigo-500/10 text-indigo-300";
            return <span key={lineIndex} className={"block min-w-max px-5 whitespace-pre " + lineColor}>{codeLine || " "}</span>;
          })}
        </code>
      </pre>
    </section>
  ));
}
