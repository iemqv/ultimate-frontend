#!/usr/bin/env bash
# The trusted Pi transport needs network access; model output is data, never a command.
set -euo pipefail
umask 077
here=$(cd -- "$(dirname -- "$0")" && pwd)
out=$(realpath -m "${1:?Usage: bash eval/run.sh NEW_OUTPUT_DIRECTORY}")
auth=$(realpath "${PI_EVAL_AUTH:?Set PI_EVAL_AUTH to the dedicated evaluation auth.json}")
[[ $auth != "$(realpath -m "$HOME/.pi/agent/auth.json")" ]]
node=$(realpath "$(command -v node)"); cli=$(realpath "$(command -v pi)"); pkg=$(dirname "$(dirname "$(dirname "$cli")")")
test -f "$pkg/dist/bundle/cli.js"
for mounted in /usr /etc "$pkg"; do
  case "$out/" in "$(realpath "$mounted")/"*) echo 'Output must be outside transport mounts.' >&2; exit 2;; esac
done
python3 - "$auth" <<'PY'
import json,sys
with open(sys.argv[1]) as f: store=json.load(f)
if set(store)!={'openai'} or store['openai'].get('type') not in ('api_key','oauth'): sys.exit('Expected a dedicated OpenAI-only Pi auth store.')
PY
# Refresh the dedicated profile once before freezing credentials, never log the token.
if ! python3 -c 'import json,sys;sys.exit(json.load(open(sys.argv[1]))["openai"]["type"]!="api_key")' "$auth"; then
  [[ $(basename "$auth") == auth.json ]]; PI_CODING_AGENT_DIR=$(dirname "$auth") pi auth print-bearer-token --provider openai --min-expiry 26m >/dev/null
fi
mkdir -- "$out"; mkdir "$out"/{logs,briefs,arms}; cp "$here"/{basic,detailed}.txt "$out/briefs/"; cp -R "$here/../skills/ultimate-frontend" "$out/skill"
printf 'Pi %s; Node %s; openai/gpt-6.2-sol; medium; no tools\n' "$(pi --version)" "$(node --version)" >"$out/runtime.txt"
printf '%s' 'Return only one complete standalone HTML document, with inline styles, scripts and artwork. No external resources, navigation to other sites or network requests. No tools are available. Do not claim to have inspected a render.' >"$out/system.txt"
python3 "$here/trace.py" --bundle "$out/skill" >"$out/treatment.txt"
box=(bwrap --die-with-parent --new-session --unshare-pid --unshare-ipc --unshare-uts --clearenv --ro-bind /usr /usr --dev /dev --proc /proc --tmpfs /tmp --dir /home/eval --dir /home/eval/.pi/agent --dir /work --chdir /work --ro-bind "$node" /opt/bin/node --ro-bind "$pkg" /opt/pi --setenv HOME /home/eval --setenv USER eval --setenv LANG C.UTF-8 --setenv PATH /opt/bin:/usr/bin)
for entry in /bin /sbin /lib /lib64; do if [[ -L $entry ]]; then box+=(--symlink "$(readlink "$entry")" "$entry"); fi; done
for f in hosts resolv.conf nsswitch.conf services protocols ssl ca-certificates; do if [[ -e /etc/$f ]]; then box+=(--ro-bind "/etc/$f" "/etc/$f"); fi; done
run_arm() (
  name=$1-$2; mkdir "$out/arms/$name"; system=$(<"$out/system.txt"); if [[ $2 == skill ]]; then system+=$'\n\n'"$(<"$out/treatment.txt")"; fi
  timeout 20m "${box[@]}" --perms 0600 --file 3 /home/eval/.pi/agent/auth.json -- /opt/bin/node /opt/pi/dist/bundle/cli.js --offline --no-session --no-extensions --no-context-files --no-mcp --no-prompt-templates --no-themes --no-skills --no-tools --no-approve --system-prompt "$system" --model openai/gpt-6.2-sol --thinking medium --mode json -p -- "$(<"$out/briefs/$1.txt")" 3<"$auth" 2>"$out/logs/$name.stderr" | python3 "$here/trace.py" "$out" "$name"
)
pids=(); for brief in basic detailed; do for arm in plain skill; do run_arm "$brief" "$arm" & pids+=("$!"); done; done
rc=0; for pid in "${pids[@]}"; do wait "$pid" || rc=1; done; (( rc == 0 )); printf 'all four pipelines exited zero\n' >"$out/completed.txt"; python3 -B "$here/verify.py" "$out"
