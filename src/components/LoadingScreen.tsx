const LETTERS_ALUGA = ['A', 'l', 'u', 'g', 'a'];
const LETTERS_SUL = ['S', 'u', 'l'];

export function LoadingScreen() {
  return (
    <div className="app-loading-screen">
      <div className="app-loading-inner">
        <img src="/logoapp.png" alt="" className="app-loading-logo" />

        <div className="app-loading-name" aria-label="AlugaSul">
          <span className="app-loading-word">
            {LETTERS_ALUGA.map((l, i) => (
              <span key={i} className="app-loading-letter" style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
                {l}
              </span>
            ))}
          </span>
          <span className="app-loading-word app-loading-word--blue">
            {LETTERS_SUL.map((l, i) => (
              <span key={i} className="app-loading-letter" style={{ animationDelay: `${0.25 + (5 + i) * 0.07}s` }}>
                {l}
              </span>
            ))}
          </span>
        </div>

        <p className="app-loading-tagline">Sua estadia perfeita</p>
      </div>

      <div className="app-loading-bottom">
        <div className="app-loading-bar-track">
          <div className="app-loading-bar-fill" />
        </div>
      </div>
    </div>
  );
}
