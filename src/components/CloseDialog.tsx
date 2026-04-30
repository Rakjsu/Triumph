interface CloseDialogProps {
  show: boolean;
  onMinimizeTray: () => void;
  onCloseApp: () => void;
  onCancel: () => void;
}

export function CloseDialog({ show, onMinimizeTray, onCloseApp, onCancel }: CloseDialogProps) {
  if (!show) return null;

  return (
    <div style={{position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center"}}>
      <div className="glass-panel" style={{width: "380px", padding: "25px", border: "1px solid var(--accent-cyan)", boxShadow: "0 0 30px rgba(0, 255, 255, 0.15)"}}>
        <h3 style={{marginBottom: "15px", color: "#fff", fontSize: "20px"}}>Sair do Triumph Engine</h3>
        <p style={{color: "var(--text-muted)", marginBottom: "25px", lineHeight: "1.4"}}>
          VocÃª deseja encerrar completamente a nave-mÃ£e e parar todos os farms de carta simultÃ¢neos, ou deseja <strong>Esconder nas Sombras (Bandeja do Windows)</strong> para ela continuar farmando invisÃ­vel?
        </p>
        <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
          <button className="btn btn-primary" onClick={onMinimizeTray}>Esconder na Bandeja (Continuar Farm)</button>
          <button className="btn btn-danger" onClick={onCloseApp}>Encerrar Tudo e Sair</button>
          <button className="btn" style={{marginTop: "10px"}} onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
