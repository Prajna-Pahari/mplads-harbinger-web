import urllib.request
import json

r = urllib.request.urlopen('http://localhost:8000/api/projects')
data = json.loads(r.read())
p = next(p for p in data['projects'] if p['project_id'] == 'MPLADS-RISK-0050')

print(f"Project: {p['project_id']}")
print(f"Scores: S={p.get('schedule_score')} F={p.get('financial_score')} P={p.get('peer_score')} D={p.get('divergence_score')}")
print(f"Final: {p['final_score']} (Level: {p['risk_level']})")
print(f"Signal: {p.get('primary_signal')}")
