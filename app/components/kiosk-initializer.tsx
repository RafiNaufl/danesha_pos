'use client';

import { useEffect } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

export function KioskInitializer() {
  useEffect(() => {
    const initKiosk = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.keepAwake();
          console.log('KeepAwake enabled');
        } catch (e) {
          console.error('Failed to enable KeepAwake', e);
        }
      }
    };
    
    initKiosk();
    
    // Cleanup not strictly necessary as we want it to stay awake, 
    // but good practice if we ever unmount this provider
    return () => {
      if (Capacitor.isNativePlatform()) {
        KeepAwake.allowSleep().catch(console.error);
      }
    };
  }, []);

  return null;
}
