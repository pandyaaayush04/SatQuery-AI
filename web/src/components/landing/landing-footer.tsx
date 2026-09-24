export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-8">
        <p>&copy; 2026 SatQuery AI. Built for Smart India Hackathon.</p>
        <p className="text-center">
          Imagery: contains modified Copernicus Sentinel-1 and Sentinel-2 data (2025), via Microsoft Planetary Computer; NASA
          Earth Observatory / USGS Landsat (Poland, Florida Keys); NASA ASTER (Rondonia).
        </p>
        <p className="font-mono tracking-wide uppercase">Space for a Better Tomorrow</p>
      </div>
    </footer>
  )
}
