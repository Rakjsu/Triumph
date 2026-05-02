interface SettingsViewProps {
  autoStart: boolean;
  appVersion: string;
  toggleAutoStart: () => void;
  checkForUpdates: () => void;
}

export function SettingsView({ autoStart, appVersion, toggleAutoStart, checkForUpdates }: SettingsViewProps) {
  return (
    <section className="dashboard" style={{alignItems: "center"}}>
      <div style={{width: "100%", maxWidth: "600px"}}>
        <h2 style={{fontSize: "28px", marginBottom: "20px"}}>Global Settings</h2>
        
        <div className="glass-panel" style={{padding: "20px", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "15px"}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <div>
              <div style={{fontSize: "18px", fontWeight: 600}}>System Optimization</div>
              <div style={{fontSize: "13px", color: "var(--text-muted)"}}>Start Engine minimized when Windows boots</div>
            </div>
            <button className="btn" style={{border: `1px solid ${autoStart ? "transparent" : "var(--accent-cyan)"}`, color: autoStart ? "#000" : "var(--accent-cyan)", background: autoStart ? "var(--accent-cyan)" : "transparent"}} onClick={toggleAutoStart}>
               {autoStart ? "Enabled" : "Enable"}
            </button>
          </div>
          
          <div style={{height: "1px", background: "rgba(255,255,255,0.05)"}}></div>

          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <div>
              <div style={{fontSize: "18px", fontWeight: 600}}>Updates Manager</div>
              <div style={{fontSize: "13px", color: "var(--text-muted)"}}>
                Check for new Triumph versions{appVersion ? ` - Current version ${appVersion}` : ""}
              </div>
            </div>
            <button className="btn btn-primary" onClick={checkForUpdates}>Check Now</button>
          </div>
        </div>
      </div>
    </section>
  );
}
