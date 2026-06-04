'use client';

import React from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { X, Camera } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
}

export default function QrCodeModal({ isOpen, onClose, onScan }: QrCodeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-card-border flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-2 text-main font-semibold">
            <Camera size={18} className="text-brand-ocre" />
            Ler QR Code do Cupom
          </div>
          <button 
            onClick={onClose}
            className="text-sub hover:text-main p-1 rounded-lg hover:bg-card-border transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 bg-black/5 aspect-square relative">
          <Scanner 
            onScan={(result) => {
              if (result && result.length > 0) {
                onScan(result[0].rawValue);
              }
            }}
            components={{
              onOff: true,
              torch: true,
              zoom: true,
              finder: true
            }}
            styles={{
              container: { width: '100%', height: '100%', borderRadius: '0.75rem', overflow: 'hidden' }
            }}
          />
        </div>
        
        <div className="p-4 text-center text-sm text-sub border-t border-card-border bg-background/50">
          Aponte a câmera para o QR Code da nota fiscal (NFC-e / SAT).
        </div>
      </div>
    </div>
  );
}
