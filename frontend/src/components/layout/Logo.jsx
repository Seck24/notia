export default function Logo({ size = 'md', dark = false }) {
  const imgHeights = { sm: 'h-9', md: 'h-14', lg: 'h-20' }

  if (dark) {
    // Sidebar navy: logo image with white text/elements visible via invert trick
    // Use the image but invert the dark parts to light
    return (
      <img
        src="/logo-notia.jpg"
        alt="Notia"
        className={`${imgHeights[size]} w-auto object-contain invert brightness-200 hue-rotate-[25deg]`}
      />
    )
  }

  // Light backgrounds: blend away the white background
  return (
    <img
      src="/logo-notia.jpg"
      alt="Notia"
      className={`${imgHeights[size]} w-auto object-contain mix-blend-multiply`}
    />
  )
}
