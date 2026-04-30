import { FileText } from "lucide-react";

interface ShadowLogViewProps {
  logsText: string;
}

export function ShadowLogView({ logsText }: ShadowLogViewProps) {
  return (
    <section className="dashboard" style={{alignItems: "center", flex: 1}}>
      <div style={{width: "100%", maxWidth: "800px", display: "flex", flexDirection: "column", height: "100%", maxHeight: "600px"}}>
        <h2 style={{fontSize: "28px", marginBottom: "20px", color: "var(--accent-purple)", display: "flex", alignItems: "center", gap: "10px"}}><FileText size={28} /> Livro das Sombras</h2>
        <div className="glass-panel" style={{flex: 1, padding: "20px", overflowY: "auto", background: "rgba(0,0,0,0.8)", border: "1px solid var(--accent-purple)"}}>
           {logsText ? (
             <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
               {logsText.trim().split("\n").filter(l => l.length > 0).reverse().map((line, idx) => {
                  const dateMatch = line.match(/^\[(.*?)\]\s(.*)/);
                  if (dateMatch) {
                     return (
                       <div key={idx} style={{display: "flex", gap: "15px", padding: "12px 15px", background: "rgba(150, 0, 255, 0.05)", borderLeft: "3px solid var(--accent-purple)", borderRadius: "4px"}}>
                         <span style={{color: "#888", fontSize: "13px", whiteSpace: "nowrap"}}>{dateMatch[1]}</span>
                         <span style={{color: "#e0e0e0", fontSize: "14px"}}>{dateMatch[2]}</span>
                       </div>
                     );
                  }
                  return <div key={idx} style={{padding: "10px", color: "#ccc"}}>{line}</div>;
               })}
             </div>
           ) : (
             <div style={{color: "#0f0", fontFamily: "monospace"}}>Nenhum registro espectral encontrado.</div>
           )}
        </div>
      </div>
    </section>
  );
}
