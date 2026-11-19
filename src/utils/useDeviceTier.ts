import { useState, useEffect } from 'react';

export type DeviceTier = 'mobile' | 'tablet' | 'laptop' | 'desktop';

export interface DeviceInfo {
  tier: DeviceTier;
  isMobile: boolean;
  isTablet: boolean;
  isLaptop: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isDenseLaptop: boolean;
  windowWidth: number;
  windowHeight: number;
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      tier: 'desktop',
      isMobile: false,
      isTablet: false,
      isLaptop: true,
      isDesktop: false,
      isTouch: false,
      isDenseLaptop: false,
      windowWidth: 1366,
      windowHeight: 768
    };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;

  let tier: DeviceTier = 'desktop';
  if (w < 768) {
    tier = 'mobile';
  } else if (w < 1024) {
    tier = 'tablet';
  } else if (w < 1440) {
    tier = 'laptop';
  } else {
    tier = 'desktop';
  }

  // Common retail shop POS laptops have 1366x768 resolution or similar limited vertical height
  const isDenseLaptop = w >= 1024 && h <= 800;

  return {
    tier,
    isMobile: tier === 'mobile',
    isTablet: tier === 'tablet',
    isLaptop: tier === 'laptop',
    isDesktop: tier === 'desktop',
    isTouch,
    isDenseLaptop,
    windowWidth: w,
    windowHeight: h
  };
}

export function useDeviceTier(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getDeviceInfo);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use matchMedia queries for performant, battery-friendly breakpoint changes
    const mediaMobile = window.matchMedia('(max-width: 767px)');
    const mediaTablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const mediaLaptop = window.matchMedia('(min-width: 1024px) and (max-width: 1439px)');
    const mediaDesktop = window.matchMedia('(min-width: 1440px)');

    const update = () => {
      setDeviceInfo(getDeviceInfo());
    };

    if (mediaMobile.addEventListener) {
      mediaMobile.addEventListener('change', update);
      mediaTablet.addEventListener('change', update);
      mediaLaptop.addEventListener('change', update);
      mediaDesktop.addEventListener('change', update);
      window.addEventListener('resize', update);
    } else {
      window.addEventListener('resize', update);
    }

    return () => {
      if (mediaMobile.removeEventListener) {
        mediaMobile.removeEventListener('change', update);
        mediaTablet.removeEventListener('change', update);
        mediaLaptop.removeEventListener('change', update);
        mediaDesktop.removeEventListener('change', update);
        window.removeEventListener('resize', update);
      } else {
        window.removeEventListener('resize', update);
      }
    };
  }, []);

  return deviceInfo;
}

