export default function Logo({ size = 'md', dark = false }) {
  const heights = { sm: 'h-8', md: 'h-12', lg: 'h-20' }
  // mix-blend-mode: screen makes white transparent on dark backgrounds
  // mix-blend-mode: multiply makes white transparent on light backgrounds
  const blend = dark ? 'mix-blend-screen brightness-150' : 'mix-blend-multiply'
  return <img src="/logo-notia.jpg" alt="Notia" className={`${heights[size]} w-auto object-contain ${blend}`} />
}
