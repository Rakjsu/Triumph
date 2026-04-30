import type { VaultBackup } from "../types";

interface VaultModalProps {
  show: boolean;
  vaults: VaultBackup[];
  onRestore: (timestampId: string) => void;
  onCancel: () => void;
}

export function VaultModal({ show, vaults, onRestore, onCancel }: VaultModalProps) {
  if (!show) return null;

  return (
    <div style={{position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center"}}>
      <div className="glass-panel" style={{width: "450px", padding: "25px", border: "1px solid var(--accent-purple)", boxShadow: "0 0 40px rgba(150, 0, 255, 0.2)"}}>
        <h3 style={{marginBottom: "15px", color: "#fff", fontSize: "20px"}}>Restaurar Ponto Temporal</h3>
        <p style={{color: "var(--text-muted)", marginBottom: "20px", lineHeight: "1.4"}}>
          {vaults.length > 0 ? "Selecione um backup do Vault para reverter todas as conquistas deste jogo para o exato estado anterior." : "Nenhum backup encontrado para este jogo."}
        </p>
        <div style={{display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", maxHeight: "250px", overflowY: "auto", paddingRight: "10px"}}>
          {vaults.map((v) => (
            <button key={v.timestamp} className="btn" style={{justifyContent: "space-between", background: "rgba(255,255,255,0.05)", padding: "12px", border: "1px solid rgba(255,255,255,0.1)"}} onClick={() => onRestore(v.timestamp)}>
               <span style={{fontFamily: "monospace", color: "#ccc"}}>{v.timestamp.replace(/_/g, " as ").replace(/(\d{4})(\d{2})(\d{2})/, "$3/$2/$1")}</span>
               <span style={{color: "var(--accent-purple)"}}>Restaurar</span>
            </button>
          ))}
        </div>
        <button className="btn btn-danger" style={{width: "100%"}} onClick={onCancel}>Cancelar OperaÃ§Ã£o</button>
      </div>
    </div>
  );
}
