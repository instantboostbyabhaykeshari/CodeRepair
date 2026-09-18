export default function DiffViewer({ diffs }) {
  return diffs.map(({ path: filePath, diff: fileDiff }) => (
    <section key={filePath} className="min-w-0 border-t border-stone-200">
      <h3 className="bg-stone-100 px-5 py-3 font-mono text-xs break-all text-stone-700">{filePath}</h3>
      <pre tabIndex={0} className="overflow-x-auto py-4 font-mono text-xs leading-6 [tab-size:4]" aria-label={"Proposed changes for " + filePath}>
        <code>
          {fileDiff.split("\n").map((codeLine, lineIndex) => {
            let lineColor = "text-stone-500";
            if (codeLine.startsWith("+")) lineColor = "bg-emerald-50 text-emerald-700";
            if (codeLine.startsWith("-")) lineColor = "bg-red-50 text-red-700";
            if (codeLine.startsWith("@@") || codeLine.startsWith("+++") || codeLine.startsWith("---")) lineColor = "bg-indigo-50 text-indigo-700";
            return <span key={lineIndex} className={"block min-w-max px-5 whitespace-pre " + lineColor}>{codeLine || " "}</span>;
          })}
        </code>
      </pre>
    </section>
  ));
}
