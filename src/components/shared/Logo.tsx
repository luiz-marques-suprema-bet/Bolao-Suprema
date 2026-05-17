import { asset } from '@/lib/utils'

interface LogoProps {
  height?: number
  className?: string
}

export function Logo({ height = 40, className }: LogoProps) {
  return (
    <img
      src={asset('assets/logo-bolao.png')}
      alt="Bolão da Suprema"
      style={{ maxHeight: height, width: 'auto', maxWidth: '100%', display: 'block', alignSelf: 'flex-start' }}
      className={className}
    />
  )
}
