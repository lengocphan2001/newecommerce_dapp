import React, { useEffect, useState, useRef } from 'react';
import { notification } from 'antd';
import { notificationService } from '../services/notificationService';

interface NotificationManagerProps {
  token: string | null;
}

// Configure Ant Design notification to prevent duplicates
notification.config({
  maxCount: 1,
  rtl: false,
});

// Function to play notification sound
const playNotificationSound = () => {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for the sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure sound - pleasant notification tone
    oscillator.frequency.value = 800; // Frequency in Hz
    oscillator.type = 'sine'; // Sine wave for smooth sound
    
    // Set volume envelope (fade in/out)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    // Play the sound
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Play a second tone for a more noticeable sound
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.frequency.value = 1000;
      oscillator2.type = 'sine';
      
      gainNode2.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.3);
    }, 150);
  } catch (error) {
    console.error('Error playing notification sound:', error);
    // Fallback: try using HTML5 Audio if Web Audio API fails
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURAJR6Hh8sBwJQUwf83y3Yk5CBxou+3nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Ignore errors if audio can't play (user interaction required)
      });
    } catch (e) {
      // Silently fail if audio is not available
    }
  }
};

const NotificationManager: React.FC<NotificationManagerProps> = ({ token }) => {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const permissionGrantedRef = useRef(false);
  const handlerRef = useRef<((data: any) => void) | null>(null);

  // Handle notification permission separately
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        const granted = permission === 'granted';
        setPermissionGranted(granted);
        permissionGrantedRef.current = granted;
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setPermissionGranted(true);
      permissionGrantedRef.current = true;
    }
  }, []);

  // Handle notification service connection and listener registration
  useEffect(() => {
    if (!token) {
      notificationService.disconnect();
      if (handlerRef.current) {
        notificationService.off('new-order', handlerRef.current);
        handlerRef.current = null;
      }
      return;
    }

    // Connect to notification service
    notificationService.connect(token);

    // Only register listener once per token
    if (!handlerRef.current) {
      // Create handler function that uses ref for permissionGranted
      const handleNewOrder = (data: any) => {
        const { order, message } = data;

        // Play notification sound
        playNotificationSound();

        // Show Ant Design notification with unique key to prevent duplicates
        notification.info({
          key: `order-${order.id}`, // Unique key for each order
          message: 'New Order Received',
          description: message || `Order #${order.id.substring(0, 8)} - $${order.totalAmount}`,
          duration: 5,
          placement: 'topRight',
          onClick: () => {
            window.location.href = `/admin/orders`;
          },
        });

        // Show browser/desktop notification using ref value
        if (permissionGrantedRef.current && 'Notification' in window) {
          const browserNotification = new Notification('New Order Received', {
            body: message || `Order #${order.id.substring(0, 8)} - $${order.totalAmount}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `order-${order.id}`,
            requireInteraction: false,
          });

          browserNotification.onclick = () => {
            window.focus();
            window.location.href = `/admin/orders`;
            browserNotification.close();
          };

          // Auto close after 5 seconds
          setTimeout(() => {
            browserNotification.close();
          }, 5000);
        }
      };

      handlerRef.current = handleNewOrder;
      notificationService.on('new-order', handleNewOrder);
    }

    return () => {
      if (handlerRef.current) {
        notificationService.off('new-order', handlerRef.current);
        handlerRef.current = null;
      }
    };
  }, [token]); // Only depend on token

  // Update ref when permissionGranted changes
  useEffect(() => {
    permissionGrantedRef.current = permissionGranted;
  }, [permissionGranted]);

  return null; // This component doesn't render anything
};

export default NotificationManager;
