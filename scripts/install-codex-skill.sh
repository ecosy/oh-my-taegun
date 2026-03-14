#!/bin/sh

set -eu

usage() {
  cat <<'EOF'
Usage:
  scripts/install-codex-skill.sh <skill-name> [--force] [--codex-home <path>]

Examples:
  scripts/install-codex-skill.sh omt
  scripts/install-codex-skill.sh omt --force
  scripts/install-codex-skill.sh omt --codex-home /custom/.codex
EOF
}

if [ "$#" -lt 1 ]; then
  usage >&2
  exit 1
fi

SKILL_NAME=""
FORCE=0
CODEX_HOME_PATH="${CODEX_HOME:-}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force)
      FORCE=1
      shift
      ;;
    --codex-home)
      if [ "$#" -lt 2 ]; then
        echo "error: --codex-home requires a path" >&2
        exit 1
      fi
      CODEX_HOME_PATH="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --*)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [ -n "$SKILL_NAME" ]; then
        echo "error: only one skill name may be provided" >&2
        usage >&2
        exit 1
      fi
      SKILL_NAME="$1"
      shift
      ;;
  esac
done

if [ -z "$SKILL_NAME" ]; then
  echo "error: missing skill name" >&2
  usage >&2
  exit 1
fi

if [ -z "$CODEX_HOME_PATH" ]; then
  CODEX_HOME_PATH="$HOME/.codex"
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
SOURCE_PATH="$REPO_ROOT/skills/$SKILL_NAME"
TARGET_PARENT="$CODEX_HOME_PATH/skills"
TARGET_PATH="$TARGET_PARENT/$SKILL_NAME"

if [ ! -d "$SOURCE_PATH" ]; then
  echo "error: skill source does not exist: $SOURCE_PATH" >&2
  exit 1
fi

SOURCE_REAL=$(CDPATH= cd -- "$SOURCE_PATH" && pwd -P)

mkdir -p "$TARGET_PARENT"

if [ -L "$TARGET_PATH" ]; then
  if TARGET_REAL=$(CDPATH= cd -- "$TARGET_PATH" 2>/dev/null && pwd -P); then
    if [ "$TARGET_REAL" = "$SOURCE_REAL" ]; then
      echo "skill already installed: $TARGET_PATH -> $SOURCE_REAL"
      exit 0
    fi
  fi

  if [ "$FORCE" -ne 1 ]; then
    echo "error: target exists as a different symlink: $TARGET_PATH" >&2
    echo "hint: rerun with --force to replace it" >&2
    exit 1
  fi
fi

if [ -e "$TARGET_PATH" ] || [ -L "$TARGET_PATH" ]; then
  if [ "$FORCE" -ne 1 ]; then
    echo "error: target already exists: $TARGET_PATH" >&2
    echo "hint: rerun with --force to back it up and replace it" >&2
    exit 1
  fi

  BACKUP_PATH="${TARGET_PATH}.backup.$(date +%Y%m%d%H%M%S)"
  mv "$TARGET_PATH" "$BACKUP_PATH"
  echo "backed up existing target to: $BACKUP_PATH"
fi

ln -s "$SOURCE_REAL" "$TARGET_PATH"
echo "installed skill: $TARGET_PATH -> $SOURCE_REAL"
