#!/usr/bin/env bash

set -eu
set -o pipefail

PROG=$(basename "$0")

info() {
  echo "$(date '+[%Y-%m-%d %H:%M:%S]') ${PROG}: INFO: $*"
}

# Prints an error to stderr, and exits.
error() {
  echo "$(date '+[%Y-%m-%d %H:%M:%S]') ${PROG} ERROR: $*" >&2
  exit 1
}

main() {
  local current_version
  current_version=$(cat package.json | jq -r .version)
  info "releasing ${current_version}"
  yarn version --new-version "${current_version}"
  yarn clean
  yarn dist
  local next_version
  info "release version: ${current_version}, next version:"
  read next_version
  yarn version --no-git-tag-version --new-version "${next_version}"
  git add package.json
  git ci -m"${next_version}-SNAPSHOT"
}

main "$@"
