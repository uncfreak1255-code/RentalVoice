#!/usr/bin/env bash
set -euo pipefail

require_runtime_env_class() {
  local allowed_csv="$1"
  local action_label="$2"
  local env_class="${SUPABASE_ENV_CLASS:-unset}"
  local project_ref="${SUPABASE_PROJECT_REF:-unknown}"
  local project_label="${SUPABASE_PROJECT_LABEL:-unknown}"
  local allow_nonlive="${ALLOW_NONLIVE_SUPABASE:-false}"

  IFS=',' read -r -a allowed <<< "$allowed_csv"

  local is_allowed="false"
  local item
  for item in "${allowed[@]}"; do
    if [[ "$env_class" == "$item" ]]; then
      is_allowed="true"
      break
    fi
  done

  if [[ "$is_allowed" == "true" ]]; then
    return
  fi

  if [[ "$allow_nonlive" == "true" ]]; then
    echo "[$action_label] WARNING: continuing with SUPABASE_ENV_CLASS=$env_class for project $project_label ($project_ref) because ALLOW_NONLIVE_SUPABASE=true" >&2
    return
  fi

  cat >&2 <<EOF
[$action_label] Refusing to run against SUPABASE_ENV_CLASS=$env_class for project $project_label ($project_ref).
[$action_label] Allowed environment classes: $allowed_csv
[$action_label] If this is an intentional non-live rehearsal, set ALLOW_NONLIVE_SUPABASE=true explicitly.
EOF
  exit 1
}
