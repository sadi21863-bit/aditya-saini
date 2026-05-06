#!/bin/bash
# Run this to get current UTC time + IST
# Claude Code: run `bash now.sh` at the start of any session

UTC=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

# IST = UTC+5:30 — calculated via Node since TZ= override is unreliable on Windows
IST=$(node -e "
const d = new Date();
const ist = new Date(d.getTime() + (5*60+30)*60*1000);
const p = n => String(n).padStart(2,'0');
const [Y,M,D,h,m,s] = [ist.getUTCFullYear(),ist.getUTCMonth()+1,ist.getUTCDate(),ist.getUTCHours(),ist.getUTCMinutes(),ist.getUTCSeconds()];
console.log(Y+'-'+p(M)+'-'+p(D)+' '+p(h)+':'+p(m)+':'+p(s)+' IST');
" 2>/dev/null)

echo "UTC: $UTC"
echo "IST: ${IST:-add 5h30m to UTC manually}"
