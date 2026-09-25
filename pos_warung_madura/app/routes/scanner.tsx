import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  CameraOff,
  Zap,
  Wifi,
  WifiOff,
  CheckCircle2,
  Barcode,
  Volume2,
  VolumeX,
  Smartphone,
  Send,
  Lock,
  AlertTriangle,
  Flashlight,
  Upload,
  SwitchCamera,
  RefreshCw,
  Clock,
} from "lucide-react";

export function meta() {
  return [
    { title: "Scanner Kamera HP — POS Warung Madura" },
    {
      name: "description",
      content: "Scanner barcode nirkabel via kamera HP terhubung WebSocket ke laptop kasir",
    },
  ];
}

export default function MobileScanner() {
  const [wsConnected, setWsConnected] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [confirmationMessage, setConfirmationMessage] = useState<{
    productName: string;
    unitName: string;
    price: number;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [recentScans, setRecentScans] = useState<Array<{ code: string; time: string }>>([]);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isNonSecureHttp, setIsNonSecureHttp] = useState(false);

  // Anti-Double Scan / Cooldown Management
  const [cooldownSec, setCooldownSec] = useState<number>(2.5); // Default 2.5s safe cooldown
  const [isScanningPaused, setIsScanningPaused] = useState<boolean>(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastScannedCodeRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  const cooldownSecRef = useRef<number>(2.5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const pauseTimerRef = useRef<any>(null);
  const feedbackTimerRef = useRef<any>(null);

  // Sync cooldown ref with state
  useEffect(() => {
    cooldownSecRef.current = cooldownSec;
  }, [cooldownSec]);

  // Check if page is currently opened under insecure HTTP on LAN IP
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isHttp = window.location.protocol === "http:";
      const isNotLocal =
        window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
      setIsNonSecureHttp(isHttp && isNotLocal);
    }
  }, []);

  // Play crisp POS Beep using Web Audio API
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1800, audioCtx.currentTime); // High pitch supermarket scanner tone
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
  };

  // Setup WebSocket & BroadcastChannel
  useEffect(() => {
    // 1. BroadcastChannel for same-origin tabs
    try {
      broadcastChannelRef.current = new BroadcastChannel("pos_scanner_channel");
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data?.type === "SCAN_CONFIRMED") {
          setConfirmationMessage(event.data);
          setTimeout(() => setConfirmationMessage(null), 3500);
        }
      };
    } catch (e) {}

    // 2. WebSocket to Vite WSS endpoint (/ws-scanner)
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    const protocol = isHttps ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "localhost:5174";
    const wsUrl = `${protocol}//${host}/ws-scanner`;

    let reconnectTimer: any = null;

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          const isAndroid = typeof navigator !== "undefined" && navigator.userAgent.includes("Android");
          const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
          ws.send(
            JSON.stringify({
              type: "DEVICE_CONNECTED",
              deviceName: isAndroid ? "HP Kasir (Android)" : isIOS ? "HP Kasir (iPhone)" : "HP Kasir",
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "SCAN_CONFIRMED") {
              setConfirmationMessage(data);
              setTimeout(() => setConfirmationMessage(null), 3500);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 2000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch (e) {
        setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimer);
      clearTimeout(pauseTimerRef.current);
      clearTimeout(feedbackTimerRef.current);
      wsRef.current?.close();
      broadcastChannelRef.current?.close();
      stopCamera();
    };
  }, []);

  // Handle detected / scanned barcode with robust Anti-Double Scan Throttle
  const handleScannedBarcode = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const now = Date.now();
    const elapsed = now - lastScannedTimeRef.current;
    const sameBarcodeCooldownMs = cooldownSecRef.current * 1000;
    const differentBarcodeCooldownMs = 500; // Jeda 500ms saja untuk barang berbeda

    // 1. Jika barcode SAMA persis: kunci selama cooldown (default 2s) agar tidak dobel input
    if (cleanCode === lastScannedCodeRef.current && elapsed < sameBarcodeCooldownMs) {
      return;
    }

    // 2. Jika barcode BERBEDA: cukup jeda 500ms agar kasir bisa langsung scan barang berikutnya
    if (cleanCode !== lastScannedCodeRef.current && elapsed < differentBarcodeCooldownMs) {
      return;
    }

    // Catat barcode dan waktu scan
    lastScannedCodeRef.current = cleanCode;
    lastScannedTimeRef.current = now;
    setLastScanned(cleanCode);

    // Visual feedback "Terscan 1x"
    setScanFeedback(cleanCode);
    setIsScanningPaused(true);

    clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setScanFeedback(null);
    }, 1100);

    clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      setIsScanningPaused(false);
    }, 700);

    // Audio & Haptic Feedback
    playBeep();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([70, 30, 70]);
    }

    // Add to recent list
    setRecentScans((prev) => [
      { code: cleanCode, time: new Date().toLocaleTimeString("id-ID") },
      ...prev.slice(0, 9),
    ]);

    // Send payload via WebSocket to Laptop POS
    const payload = {
      type: "SCAN",
      barcode: cleanCode,
      timestamp: now,
      device: "HP Kasir",
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }

    // BroadcastChannel fallback
    try {
      broadcastChannelRef.current?.postMessage(payload);
    } catch (e) {}
  };

  // Start Camera using native WebRTC getUserMedia
  const startCamera = async (currentMode = facingMode) => {
    setCameraError(null);
    setCameraLoading(true);

    // Verify Secure Context
    if (typeof window !== "undefined") {
      const isHttp = window.location.protocol === "http:";
      const isNotLocal =
        window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
      if (isHttp && isNotLocal) {
        setCameraError(
          "Kamera diblokir oleh browser HP karena halaman dibuka dengan HTTP biasa (Bukan SSL). Buka dengan alamat HTTPS."
        );
        setCameraLoading(false);
        return;
      }
    }

    try {
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Try environment/back camera first with flexible constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: currentMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        // Fallback to minimal video constraint if device is picky
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;

        // Wait for video to be ready and playing
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.play().then(() => resolve()).catch(() => resolve());
          };
          // Timeout fallback in case onloadedmetadata already fired
          setTimeout(() => {
            video.play().then(() => resolve()).catch(() => resolve());
          }, 300);
        });

        setCameraActive(true);
      }

      // Check if torch/flashlight is supported
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = (track as any)?.getCapabilities?.();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch (e) {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
        setCameraError(
          "Izin kamera ditolak. Silakan ketuk ikon gembok di bilah alamat browser HP Anda dan pilih 'Izinkan Kamera'."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("Kamera belakang tidak ditemukan di perangkat ini.");
      } else if (err.name === "NotReadableError") {
        setCameraError("Kamera sedang digunakan oleh aplikasi lain di HP Anda.");
      } else {
        setCameraError(
          err.message || "Gagal membuka kamera. Coba segarkan halaman atau gunakan foto barcode di bawah."
        );
      }
      setCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsTorchOn(false);
    setHasTorch(false);
  };

  // Switch between front & back camera
  const toggleFacingMode = () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    if (cameraActive) {
      startCamera(newMode);
    }
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const nextState = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (e) {}
  };

  // Continuous Barcode Scanning Loop via BarcodeDetector (Native or Polyfill)
  useEffect(() => {
    let isRunning = true;
    let lastScanTick = 0;

    const initDetector = async () => {
      try {
        if ("BarcodeDetector" in window) {
          detectorRef.current = new (window as any).BarcodeDetector({
            formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "code_39", "qr_code"],
          });
        } else {
          // Universal polyfill powered by zxing-cpp
          const { BarcodeDetector: PolyfillDetector } = await import("barcode-detector");
          detectorRef.current = new PolyfillDetector({
            formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "code_39", "qr_code"],
          });
        }
      } catch (e) {
        console.error("BarcodeDetector init error:", e);
      }
    };

    initDetector();

    const scanLoop = async () => {
      if (!isRunning) return;

      const now = Date.now();

      // Scan frame kamera setiap ~120ms
      if (now - lastScanTick > 120) {
        lastScanTick = now;

        if (
          videoRef.current &&
          videoRef.current.readyState >= 2 &&
          !videoRef.current.paused &&
          detectorRef.current
        ) {
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const rawVal = barcodes[0].rawValue;
              if (rawVal) {
                handleScannedBarcode(rawVal);
              }
            }
          } catch (e) {
            // Frame miss is normal
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scanLoop);
    };

    if (cameraActive) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
    }

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraActive]);

  // Snap photo fallback using native camera app
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let detector = detectorRef.current;
      if (!detector) {
        if ("BarcodeDetector" in window) {
          detector = new (window as any).BarcodeDetector({
            formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "code_39", "qr_code"],
          });
        } else {
          const { BarcodeDetector: PolyfillDetector } = await import("barcode-detector");
          detector = new PolyfillDetector({
            formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "code_39", "qr_code"],
          });
        }
      }

      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((res) => (img.onload = res));

      const barcodes = await detector.detect(img);
      URL.revokeObjectURL(img.src);

      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        handleScannedBarcode(barcodes[0].rawValue);
      } else {
        alert("Barcode tidak terbaca dari foto. Coba foto lebih dekat dan pastikan barcode jelas.");
      }
    } catch (err: any) {
      alert("Gagal membaca barcode dari gambar: " + (err.message || "Format tidak didukung"));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedBarcode(manualCode.trim());
    setManualCode("");
  };

  // Redirect to HTTPS URL
  const httpsUrl = typeof window !== "undefined" ? `https://${window.location.host}/scanner` : "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-md mx-auto relative select-none">
      {/* Hidden file input for native camera snapshot fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileScan}
        className="hidden"
      />

      {/* Mobile Header Bar */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white">
            <Smartphone className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h1 className="font-bold text-white text-xs leading-none">Scanner HP Kasir</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Warung Madura WM-01</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          {/* WebSocket Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
              wsConnected
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-400"
                : "bg-amber-950/80 border-amber-500/40 text-amber-300"
            }`}
          >
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{wsConnected ? "Laptop Terhubung" : "Menghubungkan..."}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            title="Toggle Bunyi Beep"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* SSL Warning Alert (Visible if opened via plain HTTP on LAN) */}
      {isNonSecureHttp && (
        <div className="m-3 p-3.5 bg-rose-950/90 border border-rose-600/60 rounded-2xl text-xs space-y-2.5 shadow-lg">
          <div className="flex items-center gap-2 text-rose-300 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Kamera Diblokir: Halaman Dibuka via HTTP</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Browser HP (Chrome/Safari) mewajibkan koneksi <strong>HTTPS (SSL)</strong> agar kamera dapat diaktifkan.
          </p>
          <a
            href={httpsUrl}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold rounded-xl text-xs shadow-md active:scale-95 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Beralih ke HTTPS Sekarang &rarr;</span>
          </a>
          <p className="text-[10px] text-slate-400 italic">
            *Jika muncul peringatan &quot;Koneksi tidak privat&quot;, klik <strong>Lanjutan (Advanced)</strong> lalu pilih <strong>Lanjutkan ke situs</strong>.
          </p>
        </div>
      )}

      {/* Realtime Confirmation Toast from Laptop */}
      {confirmationMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-lg sticky top-[50px] z-40 transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <div>
              <span>Masuk Kasir: {confirmationMessage.productName}</span>
              <span className="block text-[10px] opacity-90">
                {confirmationMessage.unitName} &bull; Rp {confirmationMessage.price.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
          <span className="font-bold text-[10px] bg-black/20 px-2 py-0.5 rounded">TERKIRIM 1X</span>
        </div>
      )}

      {/* Main Scanner Section */}
      <main className="flex-1 p-4 space-y-3.5">
        {/* Camera Viewport Container */}
        <div className="relative rounded-2xl bg-black overflow-hidden border border-slate-800 shadow-2xl aspect-[4/3] flex items-center justify-center">
          {/* Permanent Real Native HTML5 Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              cameraActive ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"
            }`}
          />

          {/* Camera Inactive / Placeholder State */}
          {!cameraActive && (
            <div className="text-center p-6 space-y-3 flex flex-col items-center z-10">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                <Camera className="w-7 h-7 text-slate-500" />
              </div>
              <div>
                <p className="font-bold text-xs text-white">Kamera Belum Aktif</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                  Nyalakan kamera HP untuk mengarahkan ke barcode kemasan barang warung.
                </p>
              </div>

              {cameraError && (
                <p className="text-[11px] text-rose-400 max-w-[260px] bg-rose-950/50 p-2 rounded-xl border border-rose-800/40">
                  {cameraError}
                </p>
              )}

              <div className="flex flex-col gap-2 w-full max-w-[220px]">
                <button
                  onClick={() => startCamera(facingMode)}
                  disabled={cameraLoading}
                  className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {cameraLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span>{cameraLoading ? "Menghubungkan..." : "Nyalakan Kamera HP"}</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Foto Barcode Kemasan</span>
                </button>
              </div>
            </div>
          )}

          {/* Viewfinder Target Reticle with Dynamic Scan Feedback */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-10">
              <div
                className={`w-60 h-36 rounded-2xl relative flex items-center justify-center transition-all duration-300 ${
                  scanFeedback
                    ? "border-3 border-emerald-400 bg-emerald-500/15 shadow-[0_0_25px_rgba(52,211,153,0.5)] scale-102"
                    : isScanningPaused
                    ? "border-2 border-dashed border-amber-400/40 bg-black/20"
                    : "border-2 border-dashed border-amber-400/90"
                }`}
              >
                {/* Laser scan line effect (only active when ready to scan) */}
                {!isScanningPaused && !scanFeedback && (
                  <div className="w-full h-0.5 bg-rose-500 shadow-md shadow-rose-500/80 absolute top-1/2 -translate-y-1/2 animate-pulse"></div>
                )}

                {/* Instant Success Feedback Badge inside viewfinder */}
                {scanFeedback ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-1 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/30 border border-emerald-400 flex items-center justify-center shadow-lg">
                      <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                    </div>
                    <span className="text-[11px] font-bold text-emerald-300 tracking-wide uppercase">
                      Terscan 1x
                    </span>
                    <span className="font-mono text-[10px] text-white bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                      {scanFeedback}
                    </span>
                  </div>
                ) : isScanningPaused ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-0.5">
                    <span className="text-[11px] font-semibold text-amber-300">
                      Arahkan ke Barang Lain
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Jeda {cooldownSec}s anti-dobel
                    </span>
                  </div>
                ) : (
                  <span className="absolute -bottom-6 left-0 right-0 text-center text-[10px] font-mono text-amber-300 font-semibold tracking-wider drop-shadow">
                    ARAHKAN KE BARCODE
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action buttons on camera view */}
          {cameraActive && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2 z-20">
              {/* Camera Switch / Flip Button */}
              <button
                onClick={toggleFacingMode}
                className="p-2 rounded-xl bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 hover:text-white"
                title="Ganti Kamera Depan / Belakang"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>

              {/* Torch Button if supported */}
              {hasTorch && (
                <button
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl backdrop-blur border text-xs font-semibold ${
                    isTorchOn
                      ? "bg-amber-500 text-white border-amber-400"
                      : "bg-slate-900/80 border-slate-700 text-slate-300"
                  }`}
                  title="Flashlight"
                >
                  <Flashlight className="w-4 h-4" />
                </button>
              )}

              {/* Stop Camera Button */}
              <button
                onClick={stopCamera}
                className="p-2 rounded-xl bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 hover:text-white"
                title="Matikan Kamera"
              >
                <CameraOff className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Anti-Double Scan / Cooldown Selector Control */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-[11px]">Jeda Scan Ulang:</span>
          </div>
          <div className="flex gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {[1.5, 2.5, 3.5].map((sec) => (
              <button
                key={sec}
                onClick={() => setCooldownSec(sec)}
                className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] transition ${
                  cooldownSec === sec
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {sec}s {sec === 2.5 ? "★" : ""}
              </button>
            ))}
          </div>
        </div>

        {/* Last Scanned Barcode Card */}
        {lastScanned && (
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <Barcode className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Barcode Terakhir Terdeteksi:</span>
                <span className="font-mono font-bold text-amber-300 text-xs tracking-wider">
                  {lastScanned}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
              Terkirim 1x ⚡
            </span>
          </div>
        )}

        {/* Manual Barcode Input Fallback */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <label className="text-[11px] font-semibold text-slate-300 block">
            Ketik Barcode Manual (Bila Bungkus Kusut):
          </label>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Contoh: 899238812039..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim</span>
            </button>
          </form>
        </div>

        {/* Quick Simulator Test Pills on Mobile */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            Tombol Uji Cepat (Simulasi):
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleScannedBarcode("899238812039")}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition"
            >
              <span className="font-bold text-xs text-white block">Sampoerna Mild</span>
              <span className="text-[10px] text-slate-400 font-mono">Bungkus: 899238812039</span>
            </button>
            <button
              onClick={() => handleScannedBarcode("089686010999")}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition"
            >
              <span className="font-bold text-xs text-white block">Indomie Goreng</span>
              <span className="text-[10px] text-slate-400 font-mono">Dus: 089686010999</span>
            </button>
            <button
              onClick={() => handleScannedBarcode("899600141401")}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition"
            >
              <span className="font-bold text-xs text-white block">Le Minerale</span>
              <span className="text-[10px] text-slate-400 font-mono">Botol: 899600141401</span>
            </button>
            <button
              onClick={() => handleScannedBarcode(`899${Math.floor(100000000 + Math.random() * 900000000)}`)}
              className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 hover:bg-rose-900/50 text-left transition"
            >
              <span className="font-bold text-xs text-rose-300 block">+ Barcode Baru</span>
              <span className="text-[10px] text-slate-400 font-mono">Uji Modal Cepat</span>
            </button>
          </div>
        </div>

        {/* History of recent scans */}
        {recentScans.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 block">Riwayat Terkirim:</span>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {recentScans.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/60"
                >
                  <span className="font-mono text-slate-300">{item.code}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer Instructions */}
      <footer className="p-3 border-t border-slate-800 bg-slate-900/60 text-center text-[11px] text-slate-400">
        Pastikan HP terhubung ke Wi-Fi / Hotspot yang sama dengan laptop kasir.
      </footer>
    </div>
  );
}
