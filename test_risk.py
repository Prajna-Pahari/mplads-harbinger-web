import urllib.request, json

# Get top 5 by risk score
r = urllib.request.urlopen('http://localhost:8000/api/risk-queue?page_size=5')
data = json.loads(r.read())
print("=== TOP 5 RISK QUEUE ===")
for q in data['queue']:
    print(f"  {q['project_id']}: score={q['final_score']:.1f} level={q['risk_level']}")
    print(f"    schedule={q['schedule_score']:.1f} financial={q['financial_score']:.1f} peer={q['peer_score']:.1f} divergence={q.get('divergence_score', 0):.1f}")

print()
# Get summary with signals
r2 = urllib.request.urlopen('http://localhost:8000/api/analytics/summary')
s = json.loads(r2.read())
print(f"=== SUMMARY ===")
print(f"HIGH={s['high_risk']} MEDIUM={s['medium_risk']} LOW={s['low_risk']}")
print(f"Signals: {s['signals']}")
