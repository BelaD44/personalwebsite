# Charis SIL font files

The page is set in **Charis SIL** (SIL Global, SIL Open Font License 1.1).
The font files could not be downloaded from the build environment, so add them once:

1. Download the official package from https://software.sil.org/charis/download/
   (or "Charis SIL" on https://fonts.google.com).
2. Copy these four files into this `fonts/` folder, keeping the names:
   - `CharisSIL-Regular.ttf`
   - `CharisSIL-Italic.ttf`
   - `CharisSIL-Bold.ttf`
   - `CharisSIL-BoldItalic.ttf`
   (`.woff2` versions with the same base names also work and are smaller.)
3. Copy the package's `OFL.txt` into this folder as well — the license requires it to
   travel with the font files.

Installing Charis SIL on your Mac (double-click the .ttf files → Install) also works;
`fonts.css` picks up an installed copy first.

Until then the page falls back to **Charter** (preinstalled on macOS — the Bitstream design
Charis SIL is based on), then Iowan Old Style, Cambria, or Georgia. It stays all-serif.
