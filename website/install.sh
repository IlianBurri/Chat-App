#!/bin/sh
# Installs Hallo on macOS and Linux:
#
#   curl -fsSL https://ilianburri.github.io/Chat-App/install.sh | sh
#
# macOS: the disk image for this Mac (Apple silicon or Intel) into /Applications (or ~/Applications).
# Linux: the .deb package via apt where available (asks for your password), otherwise the AppImage into
#        ~/.local/bin with a menu entry. Every download is checked against SHA256SUMS.txt.
# INSTALL_BASE_URL overrides the download location.
set -eu

BASE="${INSTALL_BASE_URL:-https://github.com/IlianBurri/Chat-App/releases/latest/download}"
BASE="${BASE%/}"

case "${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}" in de*) DE=1 ;; *) DE= ;; esac
say() { if [ -n "$DE" ]; then printf '%s\n' "$1"; else printf '%s\n' "$2"; fi; }
fail() { if [ -n "$DE" ]; then printf 'Fehler: %s\n' "$1" >&2; else printf 'Error: %s\n' "$2" >&2; fi; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl wird gebraucht." "curl is required."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

download() {
  curl -fL --progress-bar -o "$TMP/$1" "$BASE/$1" || fail "Download von $1 fehlgeschlagen." "Downloading $1 failed."
}

verify() {
  [ -f "$TMP/SHA256SUMS.txt" ] || download SHA256SUMS.txt
  expected=$(awk -v f="$1" '{ name = $2; sub(/^\*/, "", name); if (name == f) print tolower($1) }' "$TMP/SHA256SUMS.txt")
  [ -n "$expected" ] || fail "Keine Prüfsumme für $1 gefunden." "No checksum found for $1."
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$TMP/$1" | awk '{ print $1 }')
  else
    actual=$(shasum -a 256 "$TMP/$1" | awk '{ print $1 }')
  fi
  [ "$expected" = "$actual" ] || fail "Die Prüfsumme von $1 stimmt nicht. Der Download ist beschädigt oder wurde verändert." \
    "The checksum of $1 does not match. The download is damaged or was tampered with."
  say "Prüfsumme in Ordnung." "Checksum OK."
}

install_macos() {
  case "$(uname -m)" in
    arm64) file=Hallo-mac-arm64.dmg ;;
    x86_64) file=Hallo-mac-x64.dmg ;;
    *) fail "Diese Mac-Architektur wird nicht unterstützt." "This Mac architecture is not supported." ;;
  esac
  say "Lade Hallo herunter ($file) ..." "Downloading Hallo ($file)..."
  download "$file"
  verify "$file"

  dest=/Applications
  [ -w "$dest" ] || { dest="$HOME/Applications"; mkdir -p "$dest"; }
  mount=$(hdiutil attach -nobrowse -readonly -noautoopen "$TMP/$file" | awk -F '\t' '/\/Volumes\// { print $NF; exit }')
  [ -n "$mount" ] || fail "Das Disk-Image liess sich nicht öffnen." "The disk image could not be opened."
  osascript -e 'quit app "Hallo"' >/dev/null 2>&1 || true
  rm -rf "$dest/Hallo.app"
  cp -R "$mount/Hallo.app" "$dest/"
  hdiutil detach "$mount" -quiet || true
  say "Hallo ist installiert ($dest/Hallo.app) und startet jetzt." "Hallo is installed ($dest/Hallo.app). Starting it now."
  open "$dest/Hallo.app"
}

install_appimage() {
  file=Hallo-linux-x86_64.AppImage
  say "Lade Hallo herunter ($file) ..." "Downloading Hallo ($file)..."
  download "$file"
  verify "$file"
  bin="$HOME/.local/bin"
  apps="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  icons="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"
  mkdir -p "$bin" "$apps" "$icons"
  install -m 755 "$TMP/$file" "$bin/hallo.AppImage"
  if curl -fsL -o "$icons/hallo.png" "$BASE/hallo-icon.png"; then :; else rm -f "$icons/hallo.png"; fi
  cat >"$apps/hallo.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Hallo
Comment=Chat, Arbeitsgruppen, Anrufe, Kalender und Dateien
Exec="$bin/hallo.AppImage" %U
Icon=hallo
Categories=Network;InstantMessaging;
StartupWMClass=Hallo
Terminal=false
EOF
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$apps" >/dev/null 2>&1 || true
  if ! { ldconfig -p 2>/dev/null | grep -q 'libfuse.so.2'; }; then
    say "Hinweis: AppImages brauchen FUSE 2 (Paket libfuse2 oder fuse2)." "Note: AppImages need FUSE 2 (package libfuse2 or fuse2)."
  fi
  say "Hallo ist installiert ($bin/hallo.AppImage) und im Anwendungsmenü zu finden." "Hallo is installed ($bin/hallo.AppImage) and in your applications menu."
  nohup "$bin/hallo.AppImage" >/dev/null 2>&1 &
}

install_linux() {
  [ "$(uname -m)" = x86_64 ] || fail "Für Linux gibt es Hallo bisher nur für x86_64." "On Linux, Hallo is only available for x86_64 so far."
  if command -v apt-get >/dev/null 2>&1 && command -v dpkg >/dev/null 2>&1; then
    if [ "$(id -u)" -eq 0 ]; then sudo=; elif command -v sudo >/dev/null 2>&1; then sudo=sudo; else sudo=none; fi
    if [ "$sudo" != none ]; then
      file=hallo-linux-amd64.deb
      say "Lade Hallo herunter ($file) ..." "Downloading Hallo ($file)..."
      download "$file"
      verify "$file"
      say "Installiere das Paket (dafür braucht es dein Passwort) ..." "Installing the package (this needs your password)..."
      chmod 644 "$TMP/$file"
      $sudo apt-get install -y "$TMP/$file"
      say "Hallo ist installiert und im Anwendungsmenü zu finden." "Hallo is installed and in your applications menu."
      nohup hallo >/dev/null 2>&1 &
      return
    fi
  fi
  install_appimage
}

case "$(uname -s)" in
  Darwin) install_macos ;;
  Linux) install_linux ;;
  *) fail "Dieses Betriebssystem wird nicht unterstützt. Für Windows: siehe install.ps1." "This operating system is not supported. For Windows, see install.ps1." ;;
esac
