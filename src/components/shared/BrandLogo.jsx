const LOGO_SOURCES = {
  white: '/logo-white.png',
  black: '/logo-black.png',
  default: '/logo.png',
};

export function BrandLogo({ variant = 'default', alt = 'Passportsnap', className = '' }) {
  const source = LOGO_SOURCES[variant] || LOGO_SOURCES.default;

  return (
    <img src={source} alt={alt} className={className} />
  );
}
