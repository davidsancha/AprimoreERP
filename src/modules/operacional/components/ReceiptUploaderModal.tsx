'use client';

import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Loader2, ImagePlus } from 'lucide-react';
import jsQR from 'jsqr';

interface ReceiptUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcess: (images: string[], qrCodeUrl: string | null) => void;
}

export default function ReceiptUploaderModal({ isOpen, onClose, onProcess }: ReceiptUploaderModalProps) {
  const [images, setImages] = useState<string[]>([]);
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessingLocal(true);
      const newImages: string[] = [];
      const files = Array.from(e.target.files);
      
      for (const file of files) {
        const base64 = await readFileAsDataURL(file);
        const resizedBase64 = await resizeImage(base64, 1200);
        newImages.push(resizedBase64);
      }
      
      setImages([...images, ...newImages]);
      setIsProcessingLocal(false);
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const resizeImage = (dataUrl: string, maxWidth: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          const ratio = Math.min(maxWidth / width, maxWidth / height);
          width = width * ratio;
          height = height * ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6)); // Comprime para 60% qualidade JPEG (Evita Payload Too Large)
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const extractQRFromImage = (dataUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // Scale down slightly if too large to improve performance, but not too much to lose QR detail
        const MAX_DIMENSION = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          resolve(code.data);
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  };

  const handleProcess = async () => {
    if (images.length === 0) return;
    
    setIsProcessingLocal(true);
    let qrUrl: string | null = null;
    
    // Try to find a QR code in any of the images
    for (const imgBase64 of images) {
      const extracted = await extractQRFromImage(imgBase64);
      if (extracted) {
        qrUrl = extracted;
        break; // Stop after finding the first QR code
      }
    }
    
    setIsProcessingLocal(false);
    onProcess(images, qrUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-card-border flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-2 text-main font-semibold">
            <Camera size={18} className="text-brand-ocre" />
            Fotografar Cupom Fiscal
          </div>
          <button 
            onClick={onClose}
            className="text-sub hover:text-main p-1 rounded-lg hover:bg-card-border transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="text-sm text-sub">
            Se o cupom for longo, você pode adicionar múltiplas fotos. Certifique-se de que o <strong>QR Code</strong> e a <strong>lista de itens</strong> estejam visíveis.
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-[3/4] bg-black/10 rounded-lg overflow-hidden border border-card-border group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={`Cupom ${idx+1}`} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[3/4] flex flex-col items-center justify-center gap-2 bg-background border border-dashed border-brand-ocre/50 text-brand-ocre rounded-lg hover:bg-brand-ocre/10 transition-colors text-xs font-semibold"
              >
                <ImagePlus size={20} />
                <span>Adicionar</span>
              </button>
            </div>
          )}

          {images.length === 0 && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video flex flex-col items-center justify-center gap-3 bg-black/5 border-2 border-dashed border-card-border hover:border-brand-ocre text-sub hover:text-brand-ocre rounded-xl transition-colors"
            >
              <Upload size={32} />
              <span className="font-medium text-sm">Tirar Foto ou Escolher da Galeria</span>
            </button>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            capture="environment"
            multiple 
            className="hidden" 
            onChange={handleFileChange} 
          />

          <button
            onClick={handleProcess}
            disabled={images.length === 0 || isProcessingLocal}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-ocre text-brand-dark font-bold hover:bg-brand-ocre/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isProcessingLocal ? (
              <><Loader2 className="animate-spin" size={18} /> Processando fotos...</>
            ) : (
              <>Extrair Dados Inteligentes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
