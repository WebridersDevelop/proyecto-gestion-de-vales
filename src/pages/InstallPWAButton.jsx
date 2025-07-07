import React from 'react';

function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);

  React.useEffect(() => {
    const handler = (e) => {
      console.log('beforeinstallprompt fired');
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt) return null;

  return (
    <button
      onClick={() => {
        deferredPrompt.prompt();
        setDeferredPrompt(null);
      }}
      style={{ position: 'fixed', bottom: 100, right: 20, zIndex: 2000 }}
    >
      Instalar App
    </button>
  );
}

export default InstallPWAButton;