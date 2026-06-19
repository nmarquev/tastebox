import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Upload, X, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl } from '@/utils/api';

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoUpdate: (photoUrl: string) => void;
}

export const ProfilePhotoUpload = ({ currentPhotoUrl, onPhotoUpdate }: ProfilePhotoUploadProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropSize, setCropSize] = useState({ width: 200, height: 200 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Archivo muy grande",
          description: "La imagen debe ser menor a 5MB",
          variant: "destructive"
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Formato no válido",
          description: "Solo se permiten archivos de imagen",
          variant: "destructive"
        });
        return;
      }

      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setIsModalOpen(true);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // For now, just trigger file input - camera capture would need more complex implementation
      toast({
        title: "Funcionalidad en desarrollo",
        description: "Por ahora usa 'Subir archivo' para seleccionar una imagen",
        variant: "default"
      });
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      toast({
        title: "Error de cámara",
        description: "No se pudo acceder a la cámara",
        variant: "destructive"
      });
    }
  };

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });

    // Center the crop initially
    const size = Math.min(img.clientWidth, img.clientHeight) * 0.8;
    setCropSize({ width: size, height: size });
    setCropPosition({
      x: (img.clientWidth - size) / 2,
      y: (img.clientHeight - size) / 2
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!imageRef.current) return;

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();

    setIsDragging(true);
    setDragStart({
      x: e.clientX - rect.left - cropPosition.x,
      y: e.clientY - rect.top - cropPosition.y
    });
  }, [cropPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !imageRef.current) return;

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();

    // Calculate position relative to the image container
    const containerX = e.clientX - rect.left;
    const containerY = e.clientY - rect.top;

    const newX = Math.max(0, Math.min(containerX - dragStart.x, img.clientWidth - cropSize.width));
    const newY = Math.max(0, Math.min(containerY - dragStart.y, img.clientHeight - cropSize.height));

    setCropPosition({ x: newX, y: newY });
  }, [isDragging, dragStart, cropSize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const getCroppedImage = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      const image = imageRef.current;

      if (!canvas || !image) {
        reject(new Error('Canvas or image not available'));
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set canvas size to desired output size (square)
      const outputSize = 400;
      canvas.width = outputSize;
      canvas.height = outputSize;

      // Calculate scaling factors
      const scaleX = imageNaturalSize.width / image.clientWidth;
      const scaleY = imageNaturalSize.height / image.clientHeight;

      // Calculate crop area in natural image coordinates
      const cropX = cropPosition.x * scaleX;
      const cropY = cropPosition.y * scaleY;
      const cropWidth = cropSize.width * scaleX;
      const cropHeight = cropSize.height * scaleY;

      // Handle rotation
      if (rotation !== 0) {
        ctx.translate(outputSize / 2, outputSize / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-outputSize / 2, -outputSize / 2);
      }

      // Draw the cropped image
      ctx.drawImage(
        image,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, outputSize, outputSize
      );

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/jpeg', 0.9);
    });
  }, [cropPosition, cropSize, imageNaturalSize, rotation]);

  const handleUpload = async () => {
    if (!selectedImage) return;

    try {
      setIsUploading(true);

      // Get cropped image
      const croppedBlob = await getCroppedImage();

      // Create form data
      const formData = new FormData();
      formData.append('profilePhoto', croppedBlob, 'profile.jpg');

      // Upload to server
      const response = await fetch(`${getApiBaseUrl()}/upload/profile-photo`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      // Update photo in parent component
      onPhotoUpdate(result.photoUrl);

      toast({
        title: "Foto actualizada",
        description: "Tu foto de perfil se ha actualizado correctamente"
      });

      handleModalClose();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error de subida",
        description: "No se pudo subir la foto de perfil",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
    setPreviewUrl(null);
    setRotation(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Avatar Display */}
      <Avatar className="w-24 h-24">
        <AvatarImage src={currentPhotoUrl} />
        <AvatarFallback className="text-lg">
          {currentPhotoUrl ? 'U' : '👤'}
        </AvatarFallback>
      </Avatar>

      {/* Upload Buttons */}
      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          Subir foto
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Crop Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recortar foto de perfil</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {previewUrl && (
              <div
                className="relative mx-auto"
                style={{ maxWidth: '400px', maxHeight: '400px' }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-96 object-contain"
                  onLoad={handleImageLoad}
                  style={{ transform: `rotate(${rotation}deg)` }}
                  draggable={false}
                />

                {/* Crop overlay */}
                <div
                  className="absolute border-2 border-white shadow-lg"
                  style={{
                    left: cropPosition.x,
                    top: cropPosition.y,
                    width: cropSize.width,
                    height: cropSize.height,
                    cursor: isDragging ? 'grabbing' : 'grab'
                  }}
                  onMouseDown={handleMouseDown}
                >
                  <div className="absolute inset-0 border border-dashed border-white/50" />
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Rotar
              </Button>

              <div className="flex space-x-2">
                <Button variant="outline" onClick={handleModalClose}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleUpload} disabled={isUploading}>
                  {isUploading ? 'Subiendo...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>

          {/* Hidden canvas for processing */}
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </div>
  );
};