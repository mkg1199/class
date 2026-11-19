import { useEffect, useRef } from 'react';

interface UseBarcodeGunOptions {
  onScan: (barcode: string) => void;
  maxIntervalMs?: number; // Maximum time between keystrokes for hardware scanner (standard guns emit at 10-50ms)
  minLength?: number;     // Minimum length of scanned barcode
  enabled?: boolean;
}

/**
 * 100% Plug-and-Play Hardware USB / Bluetooth Barcode Gun Interceptor.
 * Works with any USB scanner, wireless dongle, or Bluetooth scanner out-of-the-box.
 * Zero drivers, zero setup, catches scans instantly from any screen.
 */
export function useBarcodeGun({
  onScan,
  maxIntervalMs = 75,
  minLength = 3,
  enabled = true
}: UseBarcodeGunOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore functional modifier keys (Ctrl, Alt, Meta, Tab, Esc)
      if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'Tab' || e.key === 'Escape') {
        bufferRef.current = '';
        return;
      }

      const currentTime = Date.now();
      const interval = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // When Enter is received from scanner gun:
      if (e.key === 'Enter') {
        const candidate = bufferRef.current.trim();
        if (candidate.length >= minLength) {
          bufferRef.current = '';
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(candidate);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      // Accumulate single printable characters
      if (e.key.length === 1) {
        if (interval > maxIntervalMs && bufferRef.current.length > 0) {
          // New burst starting
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, maxIntervalMs, minLength]);
}

