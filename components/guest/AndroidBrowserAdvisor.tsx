'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Copy, Check, Sparkles, X, ShieldAlert } from 'lucide-react';

interface AndroidBrowserAdvisorProps {
  onDismiss?: () => void;
  variant?: 'banner' | 'card' | 'inline';
}

export default function AndroidBrowserAdvisor({
  onDismiss,
  variant = 'banner',
}: AndroidBrowserAdvisorProps) {
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [browserName, setBrowserName] = useState<string>('Browser Bawaan');
  const [isCopied, setIsCopied] = useState(false);
  const [chromeIntentUrl, setChromeIntentUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);

    if (!isAndroid) return;

    // Detect problematic Android OEM & In-App WebViews
    const isWhatsApp = /WhatsApp/i.test(ua);
    const isInstagram = /Instagram/i.test(ua);
    const isFB = /FBAN|FBAV/i.test(ua);
    const isTikTok = /musical_ly|ByteLocale|TikTok/i.test(ua);
    const isLine = /Line/i.test(ua);
    const isVivo = /VivoBrowser/i.test(ua);
    const isOppo = /HeyTapBrowser|OppoBrowser/i.test(ua);
    const isMiui = /MiuiBrowser/i.test(ua);
    const isUC = /UCBrowser/i.test(ua);
    const isGenericWebView = /;\s*wv\s*;/i.test(ua) || (ua.includes('Version/') && ua.includes('Chrome/'));

    // Check if running on genuine standalone Google Chrome
    const isGenuineChrome =
      /Chrome\/[.0-9]+/i.test(ua) &&
      !isWhatsApp &&
      !isInstagram &&
      !isFB &&
      !isTikTok &&
      !isLine &&
      !isVivo &&
      !isOppo &&
      !isMiui &&
      !isUC &&
      !isGenericWebView;

    if (!isGenuineChrome) {
      // Determine friendly browser label
      if (isWhatsApp) setBrowserName('WhatsApp Web');
      else if (isInstagram) setBrowserName('Instagram Web');
      else if (isVivo) setBrowserName('Vivo Browser');
      else if (isOppo) setBrowserName('Oppo / HeyTap Browser');
      else if (isMiui) setBrowserName('Mi Browser');
      else if (isUC) setBrowserName('UC Browser');
      else setBrowserName('Browser Bawaan HP');

      // Construct official Android Chrome Intent URL
      // Format: intent://<host><path><query>#Intent;scheme=https;package=com.android.chrome;end
      const currentUrl = window.location.href.replace(/^https?:\/\//, '');
      const intentUrl = `intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      setChromeIntentUrl(intentUrl);

      // Check if user dismissed previously in this session
      const dismissed = sessionStorage.getItem('dismissed_browser_advisor');
      if (!dismissed) {
        setShowAdvisor(true);
      }
    }
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback manual input copy
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleDismiss = () => {
    setShowAdvisor(false);
    sessionStorage.setItem('dismissed_browser_advisor', 'true');
    if (onDismiss) onDismiss();
  };

  if (!showAdvisor) return null;

  return (
    <div
      className={`w-full rounded-2xl border transition-all duration-300 relative overflow-hidden ${
        variant === 'card'
          ? 'bg-[#1A1817] text-white border-[#B8926A]/40 shadow-xl p-4 my-2'
          : 'bg-amber-50/95 border-amber-300 text-amber-950 shadow-md p-3.5 my-2 backdrop-blur-sm'
      }`}
      style={{
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
            variant === 'card' ? 'bg-[#D4A373]/20 text-[#D4A373]' : 'bg-amber-200 text-amber-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-xs font-bold tracking-wide uppercase">
              Buka di Google Chrome
            </h4>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                variant === 'card'
                  ? 'bg-white/10 text-amber-300'
                  : 'bg-amber-200/80 text-amber-900'
              }`}
            >
              {browserName} Terdeteksi
            </span>
          </div>

          <p
            className={`text-[11px] mt-1 leading-relaxed ${
              variant === 'card' ? 'text-stone-300' : 'text-amber-800'
            }`}
          >
            Untuk memastikan kamera aktif lancar dan tampilan foto sempurna, kami sarankan membuka di <strong>Google Chrome</strong>.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {chromeIntentUrl && (
              <a
                href={chromeIntentUrl}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-sm active:scale-95 ${
                  variant === 'card'
                    ? 'bg-[#D4A373] text-stone-900 hover:bg-[#C28E5A]'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka di Chrome</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border active:scale-95 ${
                variant === 'card'
                  ? 'border-stone-700 bg-stone-800/80 text-stone-200 hover:bg-stone-700'
                  : 'border-amber-300 bg-white/80 text-amber-900 hover:bg-amber-100'
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className={`absolute top-2.5 right-2.5 p-1 rounded-full transition-colors ${
            variant === 'card'
              ? 'text-stone-400 hover:text-white hover:bg-stone-800'
              : 'text-amber-700 hover:text-amber-950 hover:bg-amber-200/60'
          }`}
          title="Tutup peringatan"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
