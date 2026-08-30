export function ProtectedPhotoPreview({
  src,
  alt,
  aspectRatio = '',
  className = '',
  imageClassName = '',
  children = null,
}) {
  const wrapperStyle = aspectRatio ? { aspectRatio } : undefined;

  return (
    <div className={`relative ${className}`.trim()} style={wrapperStyle}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`h-full w-full select-none object-contain ${imageClassName}`.trim()}
      />

      {children}
    </div>
  );
}
