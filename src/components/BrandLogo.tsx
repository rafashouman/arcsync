import Image from 'next/image';

export default function BrandLogo({ large = false }: { large?: boolean }) {
  const size = large ? 'big' : 'small';
  return <span className={`brand-logo${large ? ' brand-logo-large' : ''}`} role="img" aria-label="FeedSync">
    <Image className="brand-logo-on-dark" src={`/logo-${size}.png`} width={large ? 998 : 333} height={large ? 167 : 56} alt="" unoptimized />
    <Image className="brand-logo-on-light" src={`/logo-${size}-dark.png`} width={large ? 998 : 333} height={large ? 167 : 56} alt="" unoptimized />
  </span>;
}
