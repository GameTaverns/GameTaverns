import { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo, GalleryPhoto } from '@capacitor/camera';

interface CameraOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: CameraResultType;
}

export function useCamera() {
  const isSupported = Capacitor.isPluginAvailable('Camera');

  const takePhoto = useCallback(async (options: CameraOptions = {}): Promise<Photo | null> => {
    if (!isSupported) {
      console.warn('Camera not available on this platform');
      return null;
    }

    try {
      const photo = await Camera.getPhoto({
        quality: options.quality ?? 90,
        allowEditing: options.allowEditing ?? true,
        resultType: options.resultType ?? CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      });
      return photo;
    } catch (error) {
      console.error('Error taking photo:', error);
      return null;
    }
  }, [isSupported]);

  const pickFromGallery = useCallback(async (options: CameraOptions = {}): Promise<Photo | null> => {
    if (!isSupported) {
      console.warn('Camera not available on this platform');
      return null;
    }

    try {
      const photo = await Camera.getPhoto({
        quality: options.quality ?? 90,
        allowEditing: options.allowEditing ?? true,
        resultType: options.resultType ?? CameraResultType.DataUrl,
        source: CameraSource.Photos,
        correctOrientation: true,
      });
      return photo;
    } catch (error) {
      console.error('Error picking photo:', error);
      return null;
    }
  }, [isSupported]);

  const pickMultiple = useCallback(async (limit: number = 10): Promise<GalleryPhoto[]> => {
    if (!isSupported) {
      console.warn('Camera not available on this platform');
      return [];
    }

    try {
      const result = await Camera.pickImages({
        quality: 90,
        limit,
      });
      return result.photos;
    } catch (error) {
      console.error('Error picking multiple photos:', error);
      return [];
    }
  }, [isSupported]);

  const checkPermissions = useCallback(async () => {
    if (!isSupported) return { camera: 'denied', photos: 'denied' };
    
    try {
      const permissions = await Camera.checkPermissions();
      return permissions;
    } catch (error) {
      console.error('Error checking camera permissions:', error);
      return { camera: 'denied', photos: 'denied' };
    }
  }, [isSupported]);

  const requestPermissions = useCallback(async () => {
    if (!isSupported) return { camera: 'denied', photos: 'denied' };
    
    try {
      const permissions = await Camera.requestPermissions();
      return permissions;
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return { camera: 'denied', photos: 'denied' };
    }
  }, [isSupported]);

  return {
    isSupported,
    takePhoto,
    pickFromGallery,
    pickMultiple,
    checkPermissions,
    requestPermissions,
  };
}
