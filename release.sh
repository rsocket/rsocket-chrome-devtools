#!/usr/bin/env bash

set -eu
set -o pipefail

PROG=$(basename "$0")

info() {
  echo "$(date '+[%Y-%m-%d %H:%M:%S]') ${PROG}: INFO: $*"
}

error() {
  echo "$(date '+[%Y-%m-%d %H:%M:%S]') ${PROG} ERROR: $*" >&2
  exit 1
}

check_uncommitted_changes() {
  if ! git diff-index --quiet HEAD --; then
    error "There are uncommitted changes in the working directory."
  fi
}

main() {
  local current_version
  current_version=$(cat package.json | jq -r .version)
  info "Releasing ${current_version}"

  yarn version --new-version "${current_version}"
  yarn clean
  yarn install
  check_uncommitted_changes
  yarn dist
  local next_version
  info "Release version: ${current_version}, next version:"
  read next_version
  yarn version --no-git-tag-version --new-version "${next_version}"
  git add package.json
  git ci -m"${next_version}-SNAPSHOT"
}

main "$@"
