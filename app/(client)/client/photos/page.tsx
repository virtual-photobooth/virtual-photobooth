'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Photo } from '@/lib/types/database';
import { Image as ImageIcon, Download, Calendar, User, X, Sparkles } from 'lucide-react';

import { getClientScope } from '@/lib/utils/client-scope';

export default function ClientPhotosPage() {
  const supabase = createClient();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

  useEffect(() => {
    async function loadPhotos() {
      try {
        setLoading(true);
        const res = await fetch('/api/client/data');
        const data = await res.json();

        if (data?.photos) {
          setPhotos(data.photos);
        }
      } catch (err) {
        console.error('Failed to load photos:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPhotos();
  }, []);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2C2A29]">Galeri Foto Kenangan</h1>
          <p className="text-xs text-[#78716C] mt-1 font-serif italic">
            Semua hasil foto photobooth tamu yang telah digabung dengan bingkai eksklusif.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8C6D46] bg-[#F4EFE6] px-4 py-2 rounded-full border border-[#E2D9CC]">
            {photos.length} Hasil Foto
          </span>
        </div>
      </div>

      {/* Photos Grid */}
      {loading ? (
        <div className="py-16 text-center text-[#78716C] text-xs font-serif italic">
          Memuat galeri foto...
        </div>
      ) : photos.length === 0 ? (
        <div className="py-16 text-center text-[#78716C] text-xs font-serif italic bg-[#F4EFE6] rounded-3xl border border-[#E2D9CC]">
          Belum ada foto yang diambil oleh tamu.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-3 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
            >
              {/* Photo Preview Frame */}
              <div className="aspect-[2/3] bg-[#E8E2D8] rounded-2xl overflow-hidden relative">
                <img
                  src={photo.publicUrl}
                  alt="Photobooth memory"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-white/90 text-[#2C2A29] px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-md">
                    Lihat Foto
                  </span>
                </div>
              </div>

              {/* Photo Footer */}
              <div className="pt-3 px-1 flex items-center justify-between text-xs">
                <div>
                  <p className="font-serif font-bold text-[#2C2A29] truncate max-w-[120px]">
                    {photo.guest?.name || 'Tamu Spesial'}
                  </p>
                  <p className="text-[10px] text-[#78716C]">
                    {new Date(photo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(photo.publicUrl, `photobooth-${photo.id}.png`);
                  }}
                  className="p-2 rounded-full bg-[#E8E2D8] hover:bg-[#8C6D46] hover:text-white text-[#8C6D46] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#F9F6F0] rounded-3xl p-6 max-w-lg w-full shadow-2xl relative flex flex-col items-center">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-4 top-4 p-2 text-[#78716C] hover:text-[#2C2A29]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="max-h-[65vh] my-4 aspect-[2/3] bg-white rounded-2xl overflow-hidden shadow-lg">
              <img
                src={selectedPhoto.publicUrl}
                alt="Selected Photobooth Memory"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="w-full flex items-center justify-between pt-2 border-t border-[#E2D9CC]">
              <div>
                <p className="font-serif font-bold text-[#2C2A29]">
                  {selectedPhoto.guest?.name || 'Tamu Spesial'}
                </p>
                <p className="text-xs text-[#78716C]">
                  {new Date(selectedPhoto.created_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() =>
                  handleDownload(selectedPhoto.publicUrl, `photobooth-${selectedPhoto.id}.png`)
                }
                className="px-6 py-3 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white text-xs font-medium uppercase tracking-wider shadow-lg flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Foto</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
