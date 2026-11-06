import Image from 'next/image';

export default function BrandLogo({ large = false }: { large?: boolean }) {
  return <span className={`brand-logo${large ? ' brand-logo-large' : ''}`} role="img" aria-label="Arcsync">
    <Image className="brand-logo-on-dark" src="/logo-small.png" width={343} height={68} alt="" />
    <Image className="brand-logo-on-light" src="/logo-small-dark.png" width={343} height={68} alt="" />
  </span>;
}
