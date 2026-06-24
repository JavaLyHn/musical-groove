#!/usr/bin/env bash
# Build the macOS "Now Playing" adapter so the wallpaper can show the current track.
#
# Uses ungive/mediaremote-adapter (BSD-3). The direct MediaRemote API is gated since
# macOS 15.4; this works because /usr/bin/perl (bundle id com.apple.perl5) still has
# access and loads a small framework we compile here. No SIP changes, no admin.
#
# Requires: git, cmake (`brew install cmake`), Xcode command-line tools.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="$ROOT/vendor/mediaremote-adapter"

if ! command -v cmake >/dev/null 2>&1; then
  echo "cmake not found. Install it with:  brew install cmake" >&2
  exit 1
fi

if [ ! -d "$DST/.git" ]; then
  rm -rf "$DST"
  git clone --depth 1 https://github.com/ungive/mediaremote-adapter.git "$DST"
fi

cmake -S "$DST" -B "$DST/build"
cmake --build "$DST/build"

echo "== verifying entitlement (exit 0 = functional) =="
if /usr/bin/perl "$DST/bin/mediaremote-adapter.pl" "$DST/build/MediaRemoteAdapter.framework" test; then
  echo "OK: Now-Playing adapter is functional."
else
  echo "FAILED: adapter could not access MediaRemote." >&2
  exit 1
fi
