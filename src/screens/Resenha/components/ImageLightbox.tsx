import { motion } from 'framer-motion'
import { isSafeHttpUrl } from '@/lib/security'

interface ImageLightboxProps {
  url: string
  onClose: () => void
}

export function ImageLightbox({ url, onClose }: ImageLightboxProps) {
  if (!isSafeHttpUrl(url)) return null
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <img src={url} alt="Foto" className="max-w-full max-h-full object-contain" />
    </motion.div>
  )
}
