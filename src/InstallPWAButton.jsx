import { useEffect, useState } from 'react';

function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  };

  if (!showInstall) return null;

  return (
    <div style={{position:'fixed', bottom:20, right:20, zIndex:1000}}>
      <button
        onClick={handleInstallClick}
        style={{
          padding: '12px 24px',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        Instalar esta app
      </button>
    </div>
  );
}

export default InstallPWAButton;